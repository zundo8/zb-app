import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
  || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  || 'zicabella_whatsapp_2026';

// GET — Meta webhook verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('[WhatsApp] Webhook verification failed — token mismatch');
  return new NextResponse('Forbidden', { status: 403 });
}

// POST — Incoming WhatsApp events (messages, status updates)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Not a WhatsApp webhook' }, { status: 404 });
    }

    // Lazy-import heavy dependencies only when processing events
    // This keeps the GET handler zero-dependency for reliable verification
    const { default: db } = await import('@/lib/db');
    const { WhatsAppService } = await import('@/lib/services/whatsapp.service');

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        // Incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          await handleIncomingMessages(value.messages, value.contacts || [], db, WhatsAppService);
        }

        // Status updates (sent, delivered, read, failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          await handleStatuses(value.statuses, db);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[WhatsApp] Webhook POST error:', err);
    // Always return 200 to Meta to prevent retry storms
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

async function handleIncomingMessages(messages: any[], contacts: any[], db: any, WhatsAppService: any) {
  for (const message of messages) {
    const phoneNumber = message.from;
    const waMessageId = message.id;

    // Extract text body from different message types
    let bodyText = '';
    if (message.type === 'text') {
      bodyText = message.text?.body || '';
    } else if (message.type === 'button') {
      bodyText = message.button?.text || '';
    } else if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
      bodyText = message.interactive.button_reply?.id || '';
    }

    console.log(`[WhatsApp] Message from ${phoneNumber}: ${bodyText || '[non-text message]'}`);

    // Check for opt-out keywords
    const lowerText = bodyText.toLowerCase().trim();
    if (lowerText === 'stop' || lowerText === 'unsubscribe') {
      try {
        const user = await db.customer.findFirst({ where: { phone: { contains: phoneNumber.slice(-10) } } });
        if (user) {
          await db.customer.update({ where: { id: user.id }, data: { whatsappOptedOut: true } });
          console.log(`[WhatsApp] Opted out customer: ${phoneNumber}`);
        }
      } catch (e: any) {
        console.error('[WhatsApp] Opt-out error:', e.message);
      }
    }

    // Handle COD Confirmations via button replies
    if (message.type === 'button' || message.type === 'interactive') {
      const payload = message.type === 'button' ? message.button?.payload : message.interactive?.button_reply?.id;
      if (payload?.startsWith('COD_CONFIRM_')) {
        const orderId = payload.split('_')[2];
        await handleCODConfirmation(orderId, 'confirmed', 'whatsapp_button', db, WhatsAppService);
      } else if (payload?.startsWith('COD_CANCEL_')) {
        const orderId = payload.split('_')[2];
        await handleCODConfirmation(orderId, 'cancelled_by_customer', 'whatsapp_button', db, WhatsAppService);
      }
    }

    // Save message to database
    try {
      let userId = null;
      const customer = await db.customer.findFirst({ where: { phone: { contains: phoneNumber.slice(-10) } } });
      if (customer) userId = customer.id;

      await db.whatsAppMessage.create({
        data: {
          direction: 'inbound',
          waMessageId,
          phoneNumber,
          userId,
          body: bodyText,
          status: 'read',
        }
      });
    } catch (e: any) {
      console.error('[WhatsApp] DB save error:', e.message);
    }

    // Mark as read in Meta (fire-and-forget)
    WhatsAppService.markAsRead(waMessageId).catch((e: any) => {
      console.error('[WhatsApp] Mark-as-read error:', e.message);
    });
  }
}

async function handleStatuses(statuses: any[], db: any) {
  for (const status of statuses) {
    const waMessageId = status.id;
    const statusType = status.status; // sent, delivered, read, failed

    console.log(`[WhatsApp] Status update: ${statusType} for message ${waMessageId}`);

    const updateData: any = { status: statusType };

    if (status.errors && status.errors.length > 0) {
      updateData.errorCode = status.errors[0].code?.toString();
      updateData.errorMessage = status.errors[0].title || status.errors[0].message;
    }

    try {
      await db.whatsAppMessage.update({
        where: { waMessageId },
        data: updateData
      });

      // Also update campaign stats if applicable
      const msg = await db.whatsAppMessage.findUnique({ where: { waMessageId } });
      if (msg?.campaignId) {
        const fieldMap: Record<string, string> = {
          sent: 'statsSent',
          delivered: 'statsDelivered',
          read: 'statsRead',
          failed: 'statsFailed'
        };
        const field = fieldMap[statusType];
        if (field) {
          await db.whatsAppCampaign.update({
            where: { id: msg.campaignId },
            data: { [field]: { increment: 1 } }
          });
        }
      }
    } catch (err) {
      // Might not exist yet if out-of-order delivery
      console.error('[WhatsApp] Status update error for', waMessageId);
    }
  }
}

async function handleCODConfirmation(orderId: string, status: string, method: string, db: any, WhatsAppService: any) {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order || order.codConfirmationStatus !== 'pending') return;

    await db.order.update({
      where: { id: orderId },
      data: {
        codConfirmationStatus: status,
        codConfirmedAt: new Date(),
        codConfirmationMethod: method,
        status: status === 'confirmed' ? 'confirmed' : 'cancelled'
      }
    });

    // Trigger push notification to admin users
    try {
      const { NotificationService } = await import('@/lib/services/notification.service');
      const admins = await db.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true }
      });

      for (const admin of admins) {
        await NotificationService.sendToUser(
          admin.id,
          `COD Order ${status === 'confirmed' ? 'Confirmed' : 'Cancelled'}`,
          `Order #${order.shopifyOrderId} has been ${status} by the customer via WhatsApp.`
        ).catch((e: any) => console.error(`Error notifying admin ${admin.id}:`, e));
      }
    } catch (notifError) {
      console.error('[WhatsApp] Admin notification error:', notifError);
    }

    // Send confirmation back to customer
    const phone = WhatsAppService.formatPhone(order.customer.phone || '');
    if (phone) {
      await WhatsAppService.sendTextMessage(
        phone,
        status === 'confirmed'
          ? `✅ Thank you! Your Cash on Delivery order #${order.shopifyOrderId} is confirmed. We will pack it shortly.`
          : `❌ Your order #${order.shopifyOrderId} has been cancelled.`
      );
    }
  } catch (error) {
    console.error('[WhatsApp] COD confirmation error:', error);
  }
}
