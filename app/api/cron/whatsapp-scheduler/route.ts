import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import * as templates from '@/lib/whatsapp/templates';
import { runBroadcastInBackground } from '../../whatsapp/broadcast/helper';
import { WhatsAppService } from '@/lib/services/whatsapp.service';
import { getWhatsAppSetting } from '@/lib/whatsapp/logger';
import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

const SENDER_MAP: Record<string, any> = {
  order_confirmed: templates.sendOrderConfirmation,
  order_status: templates.sendOrderStatus,
  order_shipped: templates.sendShippingUpdate,
  out_for_delivery: templates.sendOutForDelivery,
  order_delivered: templates.sendDelivered,
  return_confirmed: templates.sendReturnConfirmed,
  abandoned_cart: templates.sendAbandonedCart,
  cart_followup: templates.sendCartRecoveryFollowUp,
  cart_final: templates.sendCartRecoveryFinalReminder,
  new_collection: templates.sendNewCollection,
  sale_alert: templates.sendSaleAlert,
  restock_alert: templates.sendRestockAlert,
  welcome: templates.sendWelcome,
  cod_confirmation: templates.sendCODConfirmation,
};

function getNextRetryTime(retryCount: number): Date | null {
  const intervals = [1, 5, 15, 60]; // minutes index [0, 1, 2, 3]
  if (retryCount >= 4) return null; // limit to 4 retries
  const minutes = intervals[retryCount] || 60;
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('[WhatsApp Scheduler] CRON_SECRET is not set in environment variables.');
    return NextResponse.json({ error: 'Unauthorized (Config missing)' }, { status: 401 });
  }

  if (secret !== cronSecret && req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any = {
    scheduledCampaignsProcessed: 0,
    campaignRecipientsRetried: 0,
    messagesRetried: 0,
    abandonedCartStep1Sent: 0,
    abandonedCartStep2Sent: 0,
    abandonedCartStep3Sent: 0,
    errors: []
  };

  let success = true;

  try {
    // 1. Process Scheduled Campaigns
    try {
      const now = new Date();
      const scheduledCampaigns = await db.whatsAppCampaign.findMany({
        where: {
          status: { in: ['scheduled', 'draft'] },
          scheduledAt: { lte: now }
        }
      });

      for (const campaign of scheduledCampaigns) {
        await db.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: { status: 'sending' }
        });

        const payload = campaign.templateParams ? JSON.parse(campaign.templateParams) : {};
        
        // Run broadcast in background
        runBroadcastInBackground(campaign.id, campaign.templateName, payload).catch((e: any) => {
          console.error(`[Scheduler] Background broadcast error for campaign ${campaign.id}:`, e);
        });
        
        results.scheduledCampaignsProcessed++;
      }
    } catch (err: any) {
      results.errors.push(`Campaign schedule error: ${err.message}`);
    }

    // 2. Process Failed Campaign Recipients (Retry queue)
    try {
      const now = new Date();
      const failedRecipients = await db.whatsAppCampaignRecipient.findMany({
        where: {
          status: 'failed',
          retryCount: { lt: 4 },
          nextRetryAt: { lte: now }
        },
        include: { campaign: true }
      });

      for (const rec of failedRecipients) {
        const campaign = rec.campaign;
        const payload = campaign.templateParams ? JSON.parse(campaign.templateParams) : {};
        const mergedParams = {
          ...payload,
          phone: rec.phone,
          customerName: rec.name
        };

        const senderFn = SENDER_MAP[campaign.templateName];
        const nextRetryCount = rec.retryCount + 1;

        if (!senderFn) {
          // Unknown sender, mark as permanently failed
          await db.whatsAppCampaignRecipient.update({
            where: { id: rec.id },
            data: { retryCount: 4, status: 'failed', errorMessage: `Unknown template: ${campaign.templateName}` }
          });
          continue;
        }

        try {
          const res = await senderFn(mergedParams);
          if (res.success) {
            await db.whatsAppCampaignRecipient.update({
              where: { id: rec.id },
              data: {
                status: 'sent',
                messageId: res.messageId,
                sentAt: new Date(),
                retryCount: nextRetryCount,
                errorMessage: null
              }
            });

            // Link campaignId to message
            if (res.messageId) {
              await db.whatsAppMessage.updateMany({
                where: { waMessageId: res.messageId },
                data: { campaignId: campaign.id }
              });
            }

            // Update campaign metrics
            await db.whatsAppCampaign.update({
              where: { id: campaign.id },
              data: {
                statsSent: { increment: 1 },
                total_sent: { increment: 1 },
                statsFailed: { decrement: 1 }
              }
            });
          } else {
            const nextRetryAt = getNextRetryTime(nextRetryCount);
            await db.whatsAppCampaignRecipient.update({
              where: { id: rec.id },
              data: {
                retryCount: nextRetryCount,
                nextRetryAt,
                errorMessage: res.error || 'Retry sending failed'
              }
            });
          }
        } catch (err: any) {
          const nextRetryAt = getNextRetryTime(nextRetryCount);
          await db.whatsAppCampaignRecipient.update({
            where: { id: rec.id },
            data: {
              retryCount: nextRetryCount,
              nextRetryAt,
              errorMessage: err.message
            }
          });
        }
        results.campaignRecipientsRetried++;
      }
    } catch (err: any) {
      results.errors.push(`Campaign recipient retry error: ${err.message}`);
    }

    // 3. Process Failed Standard Outbound Messages (Retry queue)
    try {
      const now = new Date();
      const failedMessages = await db.whatsAppMessage.findMany({
        where: {
          direction: 'outbound',
          status: 'failed',
          retryCount: { lt: 4 },
          nextRetryAt: { lte: now }
        }
      });

      for (const msg of failedMessages) {
        const nextRetryCount = msg.retryCount + 1;
        try {
          let res: any = null;
          if (msg.templateName) {
            // Try to find a matching sender function that constructs proper components.
            // Dynamically resolve template names from settings so custom renames
            // (e.g. a1/a2/a3) route to the correct sender function.
            const TEMPLATE_SETTINGS: Array<{ key: string; defaultName: string; eventType: string }> = [
              { key: 'template_abandoned_cart', defaultName: 'zica_cart_recovery_v1', eventType: 'abandoned_cart' },
              { key: 'template_cart_followup', defaultName: 'zb_cart_followup', eventType: 'cart_followup' },
              { key: 'template_cart_final', defaultName: 'zb_cart_final', eventType: 'cart_final' },
              { key: 'template_order_confirmed', defaultName: 'zica_order_confirmed_v1', eventType: 'order_confirmed' },
              { key: 'template_order_shipped', defaultName: 'zica_order_shipped', eventType: 'order_shipped' },
              { key: 'template_order_delivered', defaultName: 'zica_order_delivered_v1', eventType: 'order_delivered' },
              { key: 'template_out_for_delivery', defaultName: 'zb_out_for_delivery', eventType: 'out_for_delivery' },
              { key: 'template_return_confirmed', defaultName: 'zb_return_confirmed', eventType: 'return_confirmed' },
              { key: 'template_cod_confirmation', defaultName: 'zica_cod_confirmation_v1', eventType: 'cod_confirmation' },
              { key: 'template_order_status', defaultName: 'zb_order_status', eventType: 'order_status' },
              { key: 'template_order_tracking', defaultName: 'zb_order_tracking', eventType: 'order_tracking' },
            ];

            const templateToEvent: Record<string, string> = {};
            for (const s of TEMPLATE_SETTINGS) {
              const resolved = await getWhatsAppSetting(s.key, s.defaultName);
              templateToEvent[resolved] = s.eventType;       // custom name → event
              templateToEvent[s.defaultName] = s.eventType;  // old default → event (keep for compat)
            }

            const eventType = templateToEvent[msg.templateName];
            const senderFn = eventType ? SENDER_MAP[eventType] : null;

            if (senderFn) {
              // Use the proper sender function which constructs correct components
              res = await senderFn({
                phone: msg.phoneNumber,
                customerName: 'there', // Minimal fallback for retries
                orderId: msg.orderId || '',
                checkoutUrl: '',
              });
              // senderFn returns { success, messageId, ... }
              if (res?.success) {
                await db.whatsAppMessage.update({
                  where: { id: msg.id },
                  data: {
                    status: 'sent',
                    waMessageId: res.messageId || msg.waMessageId,
                    sentAt: new Date(),
                    retryCount: nextRetryCount,
                    errorMessage: null
                  }
                });
              } else {
                throw new Error(res?.error || 'Sender function retry failed');
              }
            } else {
              // For custom/unknown templates, use sendTemplate from client.js
              // which now auto-resolves the correct language code from the DB
              const { sendTemplate } = await import('@/lib/whatsapp/client');
              res = await sendTemplate({
                to: msg.phoneNumber,
                templateName: msg.templateName,
                languageCode: 'en', // Will be overridden by resolveTemplateLanguage
                components: []
              });
              if (res) {
                await db.whatsAppMessage.update({
                  where: { id: msg.id },
                  data: {
                    status: 'sent',
                    waMessageId: res.messages?.[0]?.id || msg.waMessageId,
                    sentAt: new Date(),
                    retryCount: nextRetryCount,
                    errorMessage: null
                  }
                });
              } else {
                throw new Error('Template retry returned empty response');
              }
            }
          } else if (msg.body) {
            // If it was a text message, re-send text
            res = await WhatsAppService.sendTextMessage(msg.phoneNumber, msg.body);
            if (res) {
              await db.whatsAppMessage.update({
                where: { id: msg.id },
                data: {
                  status: 'sent',
                  waMessageId: res.messages?.[0]?.id || msg.waMessageId,
                  sentAt: new Date(),
                  retryCount: nextRetryCount,
                  errorMessage: null
                }
              });
            } else {
              throw new Error('Text message retry returned empty response');
            }
          }
        } catch (err: any) {
          const nextRetryAt = getNextRetryTime(nextRetryCount);
          await db.whatsAppMessage.update({
            where: { id: msg.id },
            data: {
              retryCount: nextRetryCount,
              nextRetryAt,
              errorMessage: err.message
            }
          });
        }
        results.messagesRetried++;
      }
    } catch (err: any) {
      results.errors.push(`Standard message retry error: ${err.message}`);
    }

    // 4. Process Automated Cart Recovery Sequences
    try {
      const isStep1Enabled = await getWhatsAppSetting('cart_recovery_enabled', 'true') === 'true';
      const isStep2Enabled = await getWhatsAppSetting('cart_recovery_step2_enabled', 'true') === 'true';
      const isStep3Enabled = await getWhatsAppSetting('cart_recovery_step3_enabled', 'true') === 'true';

      const delay1 = parseInt(await getWhatsAppSetting('delay_abandoned_cart_step1', '5'), 10) || 5;
      const delay2 = parseInt(await getWhatsAppSetting('delay_abandoned_cart_step2', '60'), 10) || 60;
      const delay3 = parseInt(await getWhatsAppSetting('delay_abandoned_cart_step3', '10080'), 10) || 10080;

      const now = new Date();
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Only carts from the last 24 hours

      const carts = await db.cart.findMany({
        where: {
          convertedOrderId: null,
          status: { not: 'expired' },
          lastActivityAt: { gte: cutoffDate },
          items: { some: {} },
          OR: [
            { phone: { not: null } },
            { customer: { phone: { not: null } } }
          ]
        },
        include: {
          customer: true,
          items: true
        },
        take: 50
      });

      // Resolve live-configured template names for each cart recovery step.
      // Include both old defaults AND current configured names so historical
      // messages (sent under old names before the rename) still count.
      const step1Template = await getWhatsAppSetting('template_abandoned_cart', 'zica_cart_recovery_v1');
      const step2Template = await getWhatsAppSetting('template_cart_followup', 'zb_cart_followup');
      const step3Template = await getWhatsAppSetting('template_cart_final', 'zb_cart_final');

      const STEP1_DEFAULTS = ['zica_cart_recovery_v1'];
      const STEP2_DEFAULTS = ['zb_cart_followup'];
      const STEP3_DEFAULTS = ['zb_cart_final'];

      const step1Names = [...new Set([step1Template, ...STEP1_DEFAULTS])];
      const step2Names = [...new Set([step2Template, ...STEP2_DEFAULTS])];
      const step3Names = [...new Set([step3Template, ...STEP3_DEFAULTS])];
      const allRecoveryNames = [...new Set([...step1Names, ...step2Names, ...step3Names])];

      // Optimize: Fetch all recovery messages sent in the last 30 days in one single query
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recoveryMessages = await db.whatsAppMessage.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          templateName: { in: allRecoveryNames }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      for (const cart of carts) {
        const phone = cart.phone || cart.customer?.phone;
        if (!phone) continue;
        
        const formattedPhone = formatPhone(phone);
        if (!formattedPhone) continue;

        // Filter recovery messages for this phone+cart in-memory
        const sentRecoveries = recoveryMessages.filter((msg: any) => 
          msg.phoneNumber === formattedPhone && 
          msg.body && msg.body.includes(cart.id)
        );

        // Classify by step using explicit template-name matching, not by count.
        // This is robust even if a customer has duplicate messages from one step.
        const step1Sent = sentRecoveries.filter((m: any) => step1Names.includes(m.templateName));
        const step2Sent = sentRecoveries.filter((m: any) => step2Names.includes(m.templateName));
        const step3Sent = sentRecoveries.filter((m: any) => step3Names.includes(m.templateName));

        const lastActivityTime = new Date(cart.lastActivityAt).getTime();
        const elapsedMinutes = (now.getTime() - lastActivityTime) / (60 * 1000);

        if (step1Sent.length === 0) {
          // Step 1: Fired if elapsed time is between delay1 (default 5m) and 60 minutes
          if (isStep1Enabled && elapsedMinutes >= delay1 && elapsedMinutes <= 60) {
            const firstItem = cart.items?.[0] || {};
            const res = await templates.sendAbandonedCart({
              phone: formattedPhone,
              customerName: cart.customer?.name || 'there',
              checkoutUrl: `https://www.zicabella.com/cart?recover=${cart.id}`,
              productImageUrl: firstItem.image || '',
              productName: firstItem.title || '',
              cartTotal: String(cart.subtotal || '0.00'),
              itemCount: cart.items.length,
              productHandle: firstItem.handle || ''
            });

            if (cart.status === 'active') {
              await db.cart.update({
                where: { id: cart.id },
                data: { status: 'abandoned', abandonedAt: new Date() }
              });
            }

            if (res.success) results.abandonedCartStep1Sent++;
          }
        } else if (step2Sent.length === 0) {
          // Step 2: Fired if elapsed time is between delay2 (default 60m / 1h) and 180 minutes (3h)
          // Use the latest Step 1 message time for the minimum gap check
          const lastStep1Time = new Date(step1Sent[step1Sent.length - 1].createdAt).getTime();
          const elapsedSinceStep1 = (now.getTime() - lastStep1Time) / (60 * 1000);

          if (isStep2Enabled && elapsedMinutes >= delay2 && elapsedMinutes <= 180 && elapsedSinceStep1 >= 15) {
            const firstItem = cart.items?.[0] || {};
            const res = await templates.sendCartRecoveryFollowUp({
              phone: formattedPhone,
              customerName: cart.customer?.name || 'there',
              discountCode: 'ZICA10',
              checkoutUrl: `https://www.zicabella.com/cart?recover=${cart.id}`,
              productId: firstItem.productId || '',
              productImageUrl: firstItem.image || '',
              productName: firstItem.title || '',
              productHandle: firstItem.handle || '',
              cartTotal: String(cart.subtotal || '0.00'),
              itemCount: cart.items.length
            });

            if (res.success) results.abandonedCartStep2Sent++;
          }
        } else if (step3Sent.length === 0) {
          // Step 3: Fired if elapsed time is between delay3 (default 10080m / 7d) and 11520 minutes (8d)
          // Use the latest Step 2 message time for the minimum gap check
          const lastStep2Time = new Date(step2Sent[step2Sent.length - 1].createdAt).getTime();
          const elapsedSinceStep2 = (now.getTime() - lastStep2Time) / (60 * 1000);

          if (isStep3Enabled && elapsedMinutes >= delay3 && elapsedMinutes <= 11520 && elapsedSinceStep2 >= 1440) { // at least 1 day since step 2
            const firstItem = cart.items?.[0] || {};
            const res = await templates.sendCartRecoveryFinalReminder({
              phone: formattedPhone,
              customerName: cart.customer?.name || 'there',
              checkoutUrl: `https://www.zicabella.com/cart?recover=${cart.id}`,
              productId: firstItem.productId || '',
              productImageUrl: firstItem.image || '',
              productName: firstItem.title || '',
              productHandle: firstItem.handle || '',
              cartTotal: String(cart.subtotal || '0.00'),
              itemCount: cart.items.length
            });

            if (res.success) results.abandonedCartStep3Sent++;
          }
        }
      }
    } catch (err: any) {
      results.errors.push(`Abandoned cart automation error: ${err.message}`);
    }
  } catch (err: any) {
    success = false;
    results.errors.push(`Unhandled execution error: ${err.message}`);
  } finally {
    try {
      await db.whatsAppSchedulerRun.create({
        data: {
          campaignsProcessed: results.scheduledCampaignsProcessed || 0,
          campaignRecipientsRetried: results.campaignRecipientsRetried || 0,
          messagesRetried: results.messagesRetried || 0,
          abandonedCartStep1Sent: results.abandonedCartStep1Sent || 0,
          abandonedCartStep2Sent: results.abandonedCartStep2Sent || 0,
          abandonedCartStep3Sent: results.abandonedCartStep3Sent || 0,
          errorCount: results.errors.length,
          errors: results.errors.length > 0 ? results.errors.join('\n') : null,
          success: success && results.errors.length === 0
        }
      });
    } catch (logErr: any) {
      console.error('[WhatsApp Scheduler] Failed to write run log to database:', logErr.message);
    }
  }

  return NextResponse.json({ success: success && results.errors.length === 0, results });
}
