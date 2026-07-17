/**
 * WhatsApp Production Webhook Handler
 * Location: app/api/webhooks/whatsapp/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { getConfig, formatPhone } from '@/lib/whatsapp/client';
import { updateMessageStatus } from '@/lib/whatsapp/logger';
import { WhatsAppService } from '@/lib/services/whatsapp.service';
import { eventTracker } from '@/lib/services/eventTracker';

export const dynamic = 'force-dynamic';

/**
 * Helper to verify Meta signature
 */
async function verifyMetaSignature(req: NextRequest, appSecret: string): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) {
    console.warn('[WhatsApp Webhook] Missing x-hub-signature-256 header');
    return false;
  }

  const elements = signature.split('=');
  const signatureHash = elements[1];

  const clone = req.clone();
  const rawBody = await clone.text();

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'utf-8'),
      Buffer.from(expectedHash, 'utf-8')
    );
  } catch (err) {
    return false;
  }
}

/**
 * GET — Meta webhook verification handshake
 */
export async function GET(req: NextRequest) {
  const config = await getConfig();
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = config.verifyToken || 'zicabella_whatsapp_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('[WhatsApp Webhook] Verification failed — token mismatch');
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST — Process incoming webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const config = await getConfig();
    const appSecret = config.appSecret || process.env.WHATSAPP_APP_SECRET;

    // Verify Meta signature if App Secret is configured
    if (appSecret) {
      const isSignatureValid = await verifyMetaSignature(req, appSecret);
      if (!isSignatureValid) {
        console.warn('[WhatsApp Webhook] Signature verification failed. Unauthorized request.');
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    }

    const body = await req.json();
    console.log('[WhatsApp Webhook Payload Received]:', JSON.stringify(body, null, 2));

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Unsupported webhook object type' }, { status: 400 });
    }

    // 1. Record raw webhook event in database
    await db.whatsAppWebhookEvent.create({
      data: {
        eventType: body.entry?.[0]?.changes?.[0]?.field || 'messages',
        payload: body,
        processed: false
      }
    });

    // 2. Process entries
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value) continue;

        // Process incoming messages
        if (value.messages && Array.isArray(value.messages)) {
          await handleIncomingMessages(value.messages, db);
        }

        // Process delivery/read status updates
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            const { id, status, errors } = statusObj;
            let errorDetails = null;
            if (errors && errors.length > 0) {
              errorDetails = errors[0];
            }

            // Update status (sent, delivered, read, failed) and campaign logs
            await updateMessageStatus(id, status, errorDetails);
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] POST error:', error);
    // Always return 200 to Meta to avoid retry storms
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

/**
 * Handle user messages (opt-out keywords & COD button replies)
 */
async function handleIncomingMessages(messages: any[], db: any) {
  for (const message of messages) {
    const rawPhone = message.from;
    const phoneNumber = formatPhone(rawPhone); // Normalize to match all other DB write paths
    const waMessageId = message.id;

    // Extract text body
    let bodyText = '';
    if (message.type === 'text') {
      bodyText = message.text?.body || '';
    } else if (message.type === 'button') {
      bodyText = message.button?.text || '';
    } else if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
      bodyText = message.interactive.button_reply?.title || '';
    }

    console.log(`[WhatsApp Webhook] Message from ${phoneNumber}: ${bodyText}`);

    // Check opt-out keywords (STOP, UNSUBSCRIBE)
    const lowerText = bodyText.toLowerCase().trim();
    if (lowerText === 'stop' || lowerText === 'unsubscribe') {
      try {
        // Record opt-out consent status
        await db.whatsAppOptIn.upsert({
          where: { phone: phoneNumber },
          update: { status: 'opted_out', consentDate: new Date() },
          create: { phone: phoneNumber, status: 'opted_out', source: 'webhook_optout' }
        });

        // Also update local Customer profile
        const customer = await db.customer.findFirst({
          where: { phone: { contains: phoneNumber.slice(-10) } }
        });
        if (customer) {
          await db.customer.update({
            where: { id: customer.id },
            data: { whatsappOptedOut: true }
          });
        }
        console.log(`[WhatsApp Webhook] Consent marked OPTED_OUT for: ${phoneNumber}`);
      } catch (err: any) {
        console.error('[WhatsApp Webhook] Consent opt-out save error:', err.message);
      }
    } else if (lowerText === 'start' || lowerText === 'optin') {
      // Opt back in
      try {
        await db.whatsAppOptIn.upsert({
          where: { phone: phoneNumber },
          update: { status: 'opted_in', consentDate: new Date() },
          create: { phone: phoneNumber, status: 'opted_in', source: 'webhook_optin' }
        });
        const customer = await db.customer.findFirst({
          where: { phone: { contains: phoneNumber.slice(-10) } }
        });
        if (customer) {
          await db.customer.update({
            where: { id: customer.id },
            data: { whatsappOptedOut: false }
          });
        }
        console.log(`[WhatsApp Webhook] Consent marked OPTED_IN for: ${phoneNumber}`);
      } catch (err: any) {
        console.error('[WhatsApp Webhook] Consent opt-in save error:', err.message);
      }
    }

    // Handle COD confirmations via button clicks
    if (message.type === 'button' || message.type === 'interactive') {
      const payload = message.type === 'button' ? message.button?.payload : message.interactive?.button_reply?.id;
      if (payload?.startsWith('COD_CONFIRM_')) {
        const orderId = payload.split('_')[2];
        await handleCODConfirmation(orderId, 'confirmed', 'whatsapp_button', db);
      } else if (payload?.startsWith('COD_CANCEL_')) {
        const orderId = payload.split('_')[2];
        await handleCODConfirmation(orderId, 'cancelled_by_customer', 'whatsapp_button', db);
      }
    }

    // Save message to log database
    let userId = null;
    try {
      const customer = await db.customer.findFirst({
        where: { phone: { contains: phoneNumber.slice(-10) } }
      });
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
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Failed to log inbound message:', err.message);
    }

    // Track WhatsApp Chat Started event (deduplicated by a 24-hour window)
    try {
      const lastChatStarted = await db.whatsAppEvent.findFirst({
        where: {
          eventName: 'WhatsApp Chat Started',
          customerPhone: phoneNumber,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
      if (!lastChatStarted) {
        await eventTracker.trackWhatsAppConversation(userId, phoneNumber, { bodyText });
      }
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Failed to track conversation start:', err.message);
    }

    // Track WhatsApp Campaign Clicked event when interacting with buttons/quick replies
    if (message.type === 'button' || message.type === 'interactive') {
      const payload = message.type === 'button' ? message.button?.payload : message.interactive?.button_reply?.id;
      const title = message.type === 'button' ? message.button?.text : message.interactive?.button_reply?.title;
      
      try {
        // Find latest campaign message sent to this recipient to attribute click
        const lastMessage = await db.whatsAppMessage.findFirst({
          where: { phoneNumber: { contains: phoneNumber.slice(-10) }, campaignId: { not: null } },
          orderBy: { createdAt: 'desc' }
        });

        const campaignId = lastMessage?.campaignId;
        
        await eventTracker.track({
          eventName: 'WhatsApp Campaign Clicked',
          customerId: userId,
          customerPhone: phoneNumber,
          eventSource: 'whatsapp',
          metadata: {
            buttonPayload: payload,
            buttonTitle: title,
            campaignId: campaignId || null,
            messageId: lastMessage?.waMessageId || null
          }
        });

        // Increment campaign metrics in DB
        if (campaignId) {
          await db.whatsAppCampaign.update({
            where: { id: campaignId },
            data: { 
              click_count: { increment: 1 }
            }
          });
        }
      } catch (err: any) {
        console.error('[WhatsApp Webhook] Click tracking failed:', err.message);
      }
    }

    // Mark as read in Meta
    WhatsAppService.markAsRead(waMessageId).catch((err: any) => {
      console.error('[WhatsApp Webhook] Mark-as-read error:', err.message);
    });
  }
}

/**
 * Handle order COD confirmations
 */
async function handleCODConfirmation(orderId: string, status: string, method: string, db: any) {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order || order.codConfirmationStatus !== 'pending') return;

    // Update order verification state
    await db.order.update({
      where: { id: orderId },
      data: {
        codConfirmationStatus: status,
        codConfirmedAt: new Date(),
        codConfirmationMethod: method,
        status: status === 'confirmed' ? 'confirmed' : 'cancelled'
      }
    });

    console.log(`[WhatsApp Webhook] COD order ${orderId} marked: ${status}`);

    // Notify admins
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
          `Order #${order.shopifyOrderId || order.id} has been ${status} by the customer via WhatsApp.`
        ).catch((e: any) => console.error(`Error notifying admin ${admin.id}:`, e));
      }
    } catch (notifErr) {
      console.error('[WhatsApp Webhook] Admin notification dispatch failed:', notifErr);
    }

    // Send confirmation back to customer
    const phone = WhatsAppService.formatPhone(order.customer.phone || '');
    if (phone) {
      await WhatsAppService.sendTextMessage(
        phone,
        status === 'confirmed'
          ? `✅ Thank you! Your Cash on Delivery order #${order.shopifyOrderId || order.id} is confirmed. We will pack it shortly.`
          : `❌ Your order #${order.shopifyOrderId || order.id} has been cancelled.`
      );
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] COD confirmation error:', error);
  }
}
