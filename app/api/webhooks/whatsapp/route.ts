import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { WhatsAppService } from '@/lib/services/whatsapp.service';
import { NotificationService } from '@/lib/services/notification.service'; // For triggering pushes

export async function GET(req: Request) {
  // Webhook verification
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Not a WhatsApp webhook' }, { status: 404 });
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.value.messages) {
          await handleIncomingMessages(change.value.messages, change.value.contacts);
        }
        if (change.value.statuses) {
          await handleStatuses(change.value.statuses);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleIncomingMessages(messages: any[], contacts: any[]) {
  for (const message of messages) {
    const phoneNumber = message.from;
    const waMessageId = message.id;
    
    // Check for opt-out keywords
    let bodyText = '';
    if (message.type === 'text') {
      bodyText = message.text.body;
    } else if (message.type === 'button') {
      bodyText = message.button.text;
    } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
      bodyText = message.interactive.button_reply.id;
    }

    const lowerText = bodyText.toLowerCase().trim();
    if (lowerText === 'stop' || lowerText === 'unsubscribe') {
      // Find user by phone and opt them out
      const user = await db.customer.findFirst({ where: { phone: { contains: phoneNumber.slice(-10) } } });
      if (user) {
        await db.customer.update({ where: { id: user.id }, data: { whatsappOptedOut: true } });
      }
    }

    // Handle COD Confirmations via button replies
    if (message.type === 'button' || message.type === 'interactive') {
      const payload = message.type === 'button' ? message.button.payload : message.interactive.button_reply.id;
      if (payload.startsWith('COD_CONFIRM_')) {
        const orderId = payload.split('_')[2];
        await handleCODConfirmation(orderId, 'confirmed', 'whatsapp_button');
      } else if (payload.startsWith('COD_CANCEL_')) {
        const orderId = payload.split('_')[2];
        await handleCODConfirmation(orderId, 'cancelled_by_customer', 'whatsapp_button');
      }
    }

    // Save message to database
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
        status: 'read', // Auto-read for our system
      }
    });

    // Mark as read in Meta
    await WhatsAppService.markAsRead(waMessageId);
  }
}

async function handleStatuses(statuses: any[]) {
  for (const status of statuses) {
    const waMessageId = status.id;
    const statusType = status.status; // sent, delivered, read, failed

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
      // Might not exist yet if out of order delivery
      console.error('Error updating status', waMessageId);
    }
  }
}

async function handleCODConfirmation(orderId: string, status: string, method: string) {
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

    // If cancelled, trigger inventory restore (omitted for brevity, assume handler exists or is triggered via status webhook)
    
    // Trigger push notification to admin
    await NotificationService.sendToSegment(
      ['admin'], 
      `COD Order ${status === 'confirmed' ? 'Confirmed' : 'Cancelled'}`, 
      `Order #${order.shopifyOrderId} has been ${status} by the customer via WhatsApp.`
    );
    
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
    console.error('Error handling COD confirmation', error);
  }
}
