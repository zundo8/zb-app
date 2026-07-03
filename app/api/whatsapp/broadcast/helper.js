import prisma from '@/lib/db';
import * as templates from '@/lib/whatsapp/templates';
import { WhatsAppService } from '@/lib/services/whatsapp.service';

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
