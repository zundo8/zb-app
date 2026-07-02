/**
 * WhatsApp Campaign Broadcast API Endpoint with Asynchronous Processing
 * Location: app/api/whatsapp/broadcast/route.js
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone, getConfig } from '@/lib/whatsapp/client';
import * as templates from '@/lib/whatsapp/templates';
import { WhatsAppService } from '@/lib/services/whatsapp.service';

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
export async function runBroadcastInBackground(campaignId, type, payload) {
  try {
    const recipients = await prisma.whatsAppCampaignRecipient.findMany({
      where: { campaignId, status: 'queued' }
    });

    const senderFn = SENDER_MAP[type];
    const isGeneric = !senderFn;

    // Load template details if generic
    let templateRecord = null;
    let numVars = 0;
    let lang = 'en';

    if (isGeneric) {
      templateRecord = await prisma.whatsAppTemplate.findUnique({
        where: { name: type }
      });
      lang = templateRecord?.language || 'en';

      if (templateRecord && templateRecord.components) {
        const bodyComp = templateRecord.components.find(c => c.type === 'BODY');
        if (bodyComp && bodyComp.text) {
          const matches = bodyComp.text.match(/\{\{(\d+)\}\}/g) || [];
          numVars = matches.length;
        }
      }
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Enforce rate limiting delay between sends (80ms)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      try {
        let res = null;

        if (isGeneric) {
          // Format parameters for generic template
          const components = [];
          const bodyParams = [];

          for (let v = 1; v <= numVars; v++) {
            let val = payload[v] || payload[`var_${v}`] || payload[String(v)] || payload[`param_${v}`];
            // Auto replace first variable with customer name if empty or generic placeholder
            if (v === 1 && (!val || val === 'customerName' || val === 'name' || val === 'Priya' || val === 'there')) {
              val = recipient.name || 'there';
            }
            bodyParams.push({
              type: 'text',
              text: String(val || '')
            });
          }

          if (bodyParams.length > 0) {
            components.push({
              type: 'body',
              parameters: bodyParams
            });
          }

          // Call direct WhatsApp send service
          const apiResult = await WhatsAppService.sendTemplateMessage(recipient.phone, type, lang, components);
          res = {
            success: !!(apiResult && apiResult.messages && apiResult.messages.length > 0),
            messageId: apiResult?.messages?.[0]?.id || null,
            error: apiResult?.error?.message || null
          };
        } else {
          const mergedParams = {
            ...payload,
            phone: recipient.phone,
            customerName: recipient.name
          };
          res = await senderFn(mergedParams);
        }

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
            // Check if outbound message log exists, otherwise create it
            const existingMsg = await prisma.whatsAppMessage.findUnique({
              where: { waMessageId: res.messageId }
            });

            if (existingMsg) {
              await prisma.whatsAppMessage.update({
                where: { waMessageId: res.messageId },
                data: { campaignId }
              });
            } else {
              await prisma.whatsAppMessage.create({
                data: {
                  direction: 'outbound',
                  waMessageId: res.messageId,
                  phoneNumber: recipient.phone,
                  userId: recipient.id,
                  templateName: type,
                  body: `Sent WABA Template: ${type}`,
                  status: 'sent',
                  campaignId,
                  sentAt: new Date()
                }
              });
            }
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
              errorMessage: res.error || 'Meta API returned error'
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
    const { type, recipients, payload, name, scheduledAt } = await req.json();

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

    const isScheduled = scheduledAt && !isNaN(Date.parse(scheduledAt)) && new Date(scheduledAt) > new Date();

    // 1. Create campaign in database
    const campaign = await prisma.whatsAppCampaign.create({
      data: {
        name: name || `Broadcast - ${type} - ${new Date().toLocaleDateString('en-IN')}`,
        templateName: type,
        templateParams: JSON.stringify(payload),
        targetSegment: 'custom',
        status: isScheduled ? 'scheduled' : 'sending',
        scheduledAt: isScheduled ? new Date(scheduledAt) : null,
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

    // 3. Fire background worker without blocking (only if not scheduled in future)
    if (!isScheduled) {
      runBroadcastInBackground(campaign.id, type, payload);
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      message: isScheduled ? 'Campaign scheduled successfully.' : 'Campaign broadcast queued successfully.',
      totalQueued: campaignRecipients.length,
      status: isScheduled ? 'scheduled' : 'sending'
    });

  } catch (error) {
    console.error('[WhatsApp Broadcast API Route] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
