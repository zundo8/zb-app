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
  // Simple auth check via secret query param or Vercel cron headers
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET || 'zicabella_cron_2026';
  
  if (secret !== cronSecret && req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any = {
    scheduledCampaignsProcessed: 0,
    campaignRecipientsRetried: 0,
    messagesRetried: 0,
    errors: []
  };

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
          // If it was a template message, re-send template
          res = await WhatsAppService.sendTemplateMessage(msg.phoneNumber, msg.templateName);
        } else if (msg.body) {
          // If it was a text message, re-send text
          res = await WhatsAppService.sendTextMessage(msg.phoneNumber, msg.body);
        }

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
          throw new Error('Message retry returned empty response');
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

    const carts = await db.cart.findMany({
      where: {
        convertedOrderId: null,
        items: { some: {} },
        OR: [
          { phone: { not: null } },
          { customer: { phone: { not: null } } }
        ]
      },
      include: {
        customer: true,
        items: true
      }
    });

    results.abandonedCartStep1Sent = 0;
    results.abandonedCartStep2Sent = 0;
    results.abandonedCartStep3Sent = 0;

    for (const cart of carts) {
      const phone = cart.phone || cart.customer?.phone;
      if (!phone) continue;
      
      const formattedPhone = formatPhone(phone);
      if (!formattedPhone) continue;

      // Find recovery messages sent for this cart
      const sentRecoveries = await db.whatsAppMessage.findMany({
        where: {
          phoneNumber: formattedPhone,
          body: {
            contains: cart.id
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      const lastActivityTime = new Date(cart.lastActivityAt).getTime();
      const elapsedMinutes = (now.getTime() - lastActivityTime) / (60 * 1000);

      if (sentRecoveries.length === 0) {
        // Step 1
        if (isStep1Enabled && elapsedMinutes >= delay1) {
          const firstItem = cart.items?.[0] || {};
          const res = await templates.sendAbandonedCart({
            phone: formattedPhone,
            customerName: cart.customer?.name || 'there',
            checkoutUrl: `https://app.zicabella.com/cart?recover=${cart.id}`,
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
      } else if (sentRecoveries.length === 1) {
        // Step 2
        const lastSentTime = new Date(sentRecoveries[0].createdAt).getTime();
        const elapsedSinceLastSent = (now.getTime() - lastSentTime) / (60 * 1000);

        if (isStep2Enabled && elapsedMinutes >= delay2 && elapsedSinceLastSent >= 15) {
          const res = await templates.sendCartRecoveryFollowUp({
            phone: formattedPhone,
            customerName: cart.customer?.name || 'there',
            discountCode: 'ZICA10',
            checkoutUrl: `https://app.zicabella.com/cart?recover=${cart.id}`
          });

          if (res.success) results.abandonedCartStep2Sent++;
        }
      } else if (sentRecoveries.length === 2) {
        // Step 3
        const lastSentTime = new Date(sentRecoveries[1].createdAt).getTime();
        const elapsedSinceLastSent = (now.getTime() - lastSentTime) / (60 * 1000);

        if (isStep3Enabled && elapsedMinutes >= delay3 && elapsedSinceLastSent >= 1440) { // at least 1 day since step 2
          const res = await templates.sendCartRecoveryFinalReminder({
            phone: formattedPhone,
            customerName: cart.customer?.name || 'there',
            checkoutUrl: `https://app.zicabella.com/cart?recover=${cart.id}`
          });

          if (res.success) results.abandonedCartStep3Sent++;
        }
      }
    }
  } catch (err: any) {
    results.errors.push(`Abandoned cart automation error: ${err.message}`);
  }

  return NextResponse.json({ success: true, results });
}
