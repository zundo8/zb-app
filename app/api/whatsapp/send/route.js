/**
 * WhatsApp Unified Message Send API Endpoint with Opt-In Compliance
 * Location: app/api/whatsapp/send/route.js
 */

import { NextResponse } from 'next/server';
import * as templates from '@/lib/whatsapp/templates';
import { sendTemplate, formatPhone, getConfig } from '@/lib/whatsapp/client';
import { logMessage } from '@/lib/whatsapp/logger';
import { isOptedIn } from '@/lib/whatsapp/templates';
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
  cod_confirmation: templates.sendCODConfirmation,
  cart_followup: templates.sendCartRecoveryFollowUp,
  cart_final: templates.sendCartRecoveryFinalReminder,
  order_tracking: templates.sendOrderTrackingUpdate,
};

export async function POST(req) {
  const config = await getConfig();

  if (!config.configured) {
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
    let recipient = to || payload?.phone || '';
    if (!recipient) {
      return NextResponse.json(
        { error: 'Missing recipient phone number' },
        { status: 400 }
      );
    }
    recipient = formatPhone(recipient);

    // Direct Template Send (e.g. from the test form dropdown)
    if (templateName) {
      // 1. Fetch template from DB to check category compliance
      const dbTemplate = await prisma.whatsAppTemplate.findUnique({
        where: { name: templateName }
      });
      
      const isMarketing = dbTemplate?.category === 'MARKETING' || templateName === 'zica_cart_recovery_v1';

      if (isMarketing) {
        const consented = await isOptedIn(recipient);
        if (!consented) {
          const errorMsg = 'Recipient has not opted in to receive marketing messages.';
          console.warn(`[WhatsApp API Send Route] Blocked marketing template ${templateName} to ${recipient} (consent missing)`);
          
          await logMessage({
            to_number: recipient,
            template_name: templateName,
            message_body: `Template: ${templateName} (Blocked: Consent)`,
            status: 'failed',
            message_id: null,
            error_details: { error: errorMsg }
          });

          return NextResponse.json(
            { error: errorMsg },
            { status: 403 }
          );
        }
      }

      const actualLanguageCode = dbTemplate?.language || languageCode;

      try {
        console.log(`[WhatsApp API Send Route] Sending template: ${templateName} to ${recipient} (lang: ${actualLanguageCode})`);
        const result = await sendTemplate({
          to: recipient,
          templateName,
          languageCode: actualLanguageCode,
          components
        });

        const messageId = result.messages?.[0]?.id || null;

        // Log to DB via Prisma
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

    // Call the corresponding sender function (which performs consent checks internally)
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
