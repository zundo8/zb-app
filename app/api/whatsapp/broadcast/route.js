/**
 * WhatsApp Campaign Broadcast API Endpoint
 * Location: app/api/whatsapp/broadcast/route.js
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';
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
};

export async function POST(req) {
  let isConfigured = !!process.env.WHATSAPP_ACCESS_TOKEN;
  if (!isConfigured) {
    try {
      const shop = await prisma.shop.findFirst();
      if (shop?.whatsappToken) {
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
    const { type, recipients, payload } = await req.json();

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

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const phone = recipient.phone;

      if (!phone) {
        results.push({ phone: 'unknown', success: false, error: 'Missing phone number' });
        failedCount++;
        continue;
      }

      const formatted = formatPhone(phone);
      if (!formatted || formatted.length < 10) {
        results.push({ phone, success: false, error: 'Invalid phone format' });
        failedCount++;
        continue;
      }

      // Check opt-in compliance in database (whatsappOptIn === true in CommunityMember or Customer check)
      let isOptedIn = false;
      try {
        const customer = await prisma.customer.findFirst({
          where: {
            phone: {
              endsWith: formatted.slice(-10)
            }
          },
          include: {
            communityMember: true
          }
        });

        if (customer) {
          isOptedIn = !customer.whatsappOptedOut && (customer.communityMember?.whatsappOptIn === true);
        } else {
          const member = await prisma.communityMember.findFirst({
            where: {
              phone: {
                endsWith: formatted.slice(-10)
              }
            }
          });
          isOptedIn = member?.whatsappOptIn === true;
        }
      } catch (dbErr) {
        console.error(`[WhatsApp Broadcast] Database check failed for ${formatted}:`, dbErr.message);
      }

      if (!isOptedIn) {
        results.push({ phone, success: false, error: 'Customer is not opted in' });
        failedCount++;
        continue;
      }

      // Enforce rate limiting delay between sends (80ms)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }

      // Merge payload and recipient data
      const mergedParams = {
        ...payload,
        ...recipient,
        phone: formatted // use formatted phone
      };

      try {
        const res = await senderFn(mergedParams);
        if (res.success) {
          results.push({ phone, success: true, messageId: res.messageId });
          sentCount++;
        } else {
          results.push({ phone, success: false, error: res.error });
          failedCount++;
        }
      } catch (err) {
        results.push({ phone, success: false, error: err.message });
        failedCount++;
      }
    }

    return NextResponse.json({
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results
    });
  } catch (error) {
    console.error('[WhatsApp Broadcast API Route] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
