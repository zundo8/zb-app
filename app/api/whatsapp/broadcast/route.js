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

import { runBroadcastInBackground } from './helper';

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
