/**
 * WhatsApp Campaign Broadcast API Endpoint with Asynchronous Processing
 * Location: app/api/whatsapp/broadcast/route.js
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone, getConfig } from '@/lib/whatsapp/client';
import * as templates from '@/lib/whatsapp/templates';

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
};

/**
 * Background runner that executes the broadcast queue sequentially
 */
async function runBroadcastInBackground(campaignId, type, payload) {
  try {
    const recipients = await prisma.whatsAppCampaignRecipient.findMany({
      where: { campaignId, status: 'queued' }
    });

    const senderFn = SENDER_MAP[type];
    if (!senderFn) {
      await prisma.whatsAppCampaign.update({
        where: { id: campaignId },
        data: { status: 'failed' }
      });
      return;
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      const mergedParams = {
        ...payload,
        phone: recipient.phone,
        customerName: recipient.name
      };

      // Enforce rate limiting delay between sends (80ms)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      try {
        const res = await senderFn(mergedParams);

        if (res.success) {
          // Update recipient delivery status
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'sent',
              messageId: res.messageId,
              sentAt: new Date()
            }
          });

          // Link campaignId to the outbound message log
          if (res.messageId) {
            await prisma.whatsAppMessage.updateMany({
              where: { waMessageId: res.messageId },
              data: { campaignId }
            });
          }

          // Increment campaign sent count
          await prisma.whatsAppCampaign.update({
            where: { id: campaignId },
            data: {
              statsSent: { increment: 1 }
            }
          });
        } else {
          // Send failed (due to consent or Meta API issues)
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'failed',
              errorMessage: res.error
            }
          });

          await prisma.whatsAppCampaign.update({
            where: { id: campaignId },
            data: {
              statsFailed: { increment: 1 }
            }
          });
        }
      } catch (err) {
        await prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'failed',
            errorMessage: err.message
          }
        });

        await prisma.whatsAppCampaign.update({
          where: { id: campaignId },
          data: {
            statsFailed: { increment: 1 }
          }
        });
      }
    }

    // Mark campaign as completed
    await prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'completed',
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error(`[WhatsApp Broadcast Background Worker] Error in campaign ${campaignId}:`, error);
    await prisma.whatsAppCampaign.update({
      where: { id: campaignId },
      data: { status: 'failed' }
    });
  }
}

/**
 * POST — Initialize campaign and queue background broadcast
 */
export async function POST(req) {
  const config = await getConfig();

  if (!config.configured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  try {
    const { type, recipients, payload, name } = await req.json();

    if (!type || !recipients || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'Missing campaign type or recipients array' },
        { status: 400 }
      );
    }

    const senderFn = SENDER_MAP[type];
    if (!senderFn) {
      return NextResponse.json(
        { error: `Unknown template type: ${type}` },
        { status: 400 }
      );
    }

    // 1. Create campaign in database
    const campaign = await prisma.whatsAppCampaign.create({
      data: {
        name: name || `Broadcast - ${type} - ${new Date().toLocaleDateString('en-IN')}`,
        templateName: type,
        templateParams: JSON.stringify(payload),
        targetSegment: 'custom',
        status: 'sending',
        statsSent: 0,
        statsDelivered: 0,
        statsRead: 0,
        statsFailed: 0
      }
    });

    // 2. Populate recipients table
    const campaignRecipients = [];
    for (const r of recipients) {
      const phone = formatPhone(r.phone);
      if (phone) {
        campaignRecipients.push({
          campaignId: campaign.id,
          phone,
          name: r.customerName || r.name || 'Customer',
          status: 'queued'
        });
      }
    }

    if (campaignRecipients.length > 0) {
      await prisma.whatsAppCampaignRecipient.createMany({
        data: campaignRecipients
      });
    }

    // 3. Fire background worker without blocking
    runBroadcastInBackground(campaign.id, type, payload);

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      message: 'Campaign broadcast queued successfully.',
      totalQueued: campaignRecipients.length
    });

  } catch (error) {
    console.error('[WhatsApp Broadcast API Route] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
