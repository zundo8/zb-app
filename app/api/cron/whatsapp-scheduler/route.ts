import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import * as templates from '@/lib/whatsapp/templates';
import { runBroadcastInBackground } from '../../whatsapp/broadcast/route';
import { WhatsAppService } from '@/lib/services/whatsapp.service';

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

  return NextResponse.json({ success: true, results });
}
