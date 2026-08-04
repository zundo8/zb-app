import prisma from '@/lib/db';
import * as templates from '@/lib/whatsapp/templates';
import { WhatsAppService } from '@/lib/services/whatsapp.service';

export const SENDER_MAP = {
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
 * Resolves generic template details (variable count, language) from the DB.
 * Returns { templateRecord, numVars, lang } or null if template not found.
 */
async function resolveGenericTemplate(templateName) {
  const templateRecord = await prisma.whatsAppTemplate.findUnique({
    where: { name: templateName }
  });

  if (!templateRecord) return null;

  let varNames = [];
  const lang = templateRecord.language || 'en';

  if (templateRecord.components) {
    const bodyComp = templateRecord.components.find(c => c.type === 'BODY');
    if (bodyComp && bodyComp.text) {
      const matches = Array.from(bodyComp.text.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g));
      varNames = matches.map(m => m[1]);
    }
  }

  return { templateRecord, numVars: varNames.length, varNames, lang };
}

/**
 * Builds body components for a generic template from the campaign payload
 * and recipient name.
 */
function buildGenericComponents(varNames, payload, recipientName) {
  const components = [];
  const bodyParams = [];
  const names = Array.isArray(varNames) ? varNames : Array.from({ length: Number(varNames) || 0 }, (_, i) => String(i + 1));

  for (let i = 0; i < names.length; i++) {
    const vKey = names[i];
    const lowerKey = vKey.toLowerCase();
    let val = payload[vKey] || payload[lowerKey] || payload[i + 1] || payload[String(i + 1)] || payload[`var_${vKey}`] || payload[`param_${vKey}`];

    if (!val) {
      if (lowerKey.includes('name') || lowerKey.includes('customer') || i === 0) {
        val = recipientName || payload.name || payload.customerName || 'Customer';
      } else if (lowerKey.includes('order') || lowerKey.includes('id')) {
        val = payload.orderId || payload.order_id || 'Order';
      } else {
        val = 'Zica Bella';
      }
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

  return components;
}

/**
 * Sends a campaign message to a single recipient, handling both known
 * (SENDER_MAP) and generic/custom template types.
 *
 * This is the single source of truth for campaign send logic — used by both
 * `runBroadcastInBackground` and the cron recovery/retry steps.
 *
 * @param {Object} recipient - The WhatsAppCampaignRecipient record
 * @param {string} campaignId - The parent campaign ID
 * @param {string} type - The campaign templateName (SENDER_MAP key or custom template name)
 * @param {Object} payload - The campaign templateParams (parsed JSON)
 * @param {Object} [genericTemplateInfo] - Pre-resolved generic template info (optional, for batch efficiency)
 * @param {number} genericTemplateInfo.numVars - Number of body variables
 * @param {string} genericTemplateInfo.lang - Template language code
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
export async function sendCampaignRecipient(recipient, campaignId, type, payload, genericTemplateInfo = null) {
  const senderFn = SENDER_MAP[type];
  const isGeneric = !senderFn;

  try {
    let res = null;

    if (isGeneric) {
      // Resolve generic template details if not pre-resolved
      let varNames = genericTemplateInfo?.varNames ?? genericTemplateInfo?.numVars ?? 0;
      let lang = genericTemplateInfo?.lang ?? 'en';

      if (!genericTemplateInfo) {
        const resolved = await resolveGenericTemplate(type);
        if (resolved) {
          varNames = resolved.varNames;
          lang = resolved.lang;
        }
      }

      const components = buildGenericComponents(varNames, payload, recipient.name);

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

      return { success: true, messageId: res.messageId };
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

      return { success: false, error: res.error || 'Meta API returned error' };
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

    return { success: false, error: err.message };
  }
}

/**
 * Checks if all recipients for a campaign are in a terminal state (sent/failed)
 * and if so, marks the campaign as completed.
 *
 * @param {string} campaignId - The campaign ID to check and finalize
 */
export async function finalizeCampaignIfComplete(campaignId) {
  const remainingQueued = await prisma.whatsAppCampaignRecipient.count({
    where: { campaignId, status: 'queued' }
  });

  if (remainingQueued === 0) {
    // All recipients are in terminal state — mark campaign completed
    const campaign = await prisma.whatsAppCampaign.findUnique({
      where: { id: campaignId }
    });

    if (campaign && campaign.status !== 'completed') {
      await prisma.whatsAppCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'completed',
          sentAt: campaign.sentAt || new Date()
        }
      });
      console.log(`[WhatsApp Broadcast] Campaign ${campaignId} finalized as completed (all recipients in terminal state).`);
    }
  }
}

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

    // Pre-resolve generic template details once for the batch
    let genericTemplateInfo = null;
    if (isGeneric) {
      const resolved = await resolveGenericTemplate(type);
      if (resolved) {
        genericTemplateInfo = { numVars: resolved.numVars, varNames: resolved.varNames, lang: resolved.lang };
      }
    }

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Enforce rate limiting delay between sends (80ms)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      await sendCampaignRecipient(recipient, campaignId, type, payload, genericTemplateInfo);
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
