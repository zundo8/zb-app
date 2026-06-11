import { NextResponse } from 'next/server';
import * as templates from '@/lib/whatsapp/templates';
import { sendTemplate, formatPhone } from '@/lib/whatsapp/client';
import { logMessage } from '@/lib/whatsapp/logger';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const SENDER_MAP = {
  order_confirmed: templates.sendOrderConfirmation,
  order_status: templates.sendOrderStatus,
  order_shipped: templates.sendShippingUpdate,
  out_for_delivery: templates.sendOutForDelivery,
  order_delivered: templates.sendDelivered,
  return_confirmed: templates.sendReturnConfirmed,
  abandoned_cart: templates.sendAbandonedCart,
  new_collection: templates.sendNewCollection,
  sale_alert: templates.sendSaleAlert,
  restock_alert: templates.sendRestockAlert,
  welcome: templates.sendWelcome,
};

export async function POST(req) {
  // Check if WhatsApp is configured (either in env or DB)
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  let isConfigured = !!(token && phoneNumberId && wabaId);

  if (!isConfigured) {
    try {
      const shop = await prisma.shop.findFirst();
      if (shop?.whatsappToken && shop?.whatsappPhoneId) {
        isConfigured = true;
      }
    } catch (e) {}
  }

  if (!isConfigured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    console.log('[WhatsApp API Send Route Request Body]:', JSON.stringify(body, null, 2));

    const { templateName, languageCode = 'en_US', to, components, type, payload } = body;

    // Determine recipient
    let recipient = to || payload?.phone || '917907914512';
    recipient = formatPhone(recipient);

    // Direct Template Send (hello_world, or templates selected from dropdown)
    if (templateName) {
      try {
        console.log(`[WhatsApp API Send Route] Sending template: ${templateName} to ${recipient} using Graph API v19.0`);
        const result = await sendTemplate({
          to: recipient,
          templateName,
          languageCode,
          components
        });

        // Log the full response to console for debugging
        console.log('[WhatsApp Send API Full Response]:', JSON.stringify(result, null, 2));

        const messageId = result.messages?.[0]?.id || null;

        // Log the event in the database logs table (whatsapp_message_logs)
        let bodyText = `Template: ${templateName}`;
        if (components && components.length > 0) {
          bodyText += ` | Parameters: ${JSON.stringify(components)}`;
        }

        await logMessage({
          to_number: recipient,
          template_name: templateName,
          message_body: bodyText,
          status: 'sent',
          message_id: messageId,
          error_details: null
        });

        return NextResponse.json({
          success: true,
          messageId,
          result
        });
      } catch (error) {
        console.error('[WhatsApp Send API Error Details]:', error);

        await logMessage({
          to_number: recipient,
          template_name: templateName,
          message_body: `Template: ${templateName} (Failed)`,
          status: 'failed',
          message_id: null,
          error_details: { error: error.message }
        });

        return NextResponse.json(
          { error: error.message || 'Meta API returned an error' },
          { status: 500 }
        );
      }
    }

    // Legacy mapper send
    if (!type || !payload) {
      return NextResponse.json(
        { error: 'Missing type or payload' },
        { status: 400 }
      );
    }

    const senderFn = SENDER_MAP[type];

    if (!senderFn) {
      return NextResponse.json(
        { error: `Unknown message type: ${type}` },
        { status: 400 }
      );
    }

    // Call the corresponding sender function
    const result = await senderFn(payload);

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        result: result.result
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send template' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[WhatsApp Unified Send Route] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
