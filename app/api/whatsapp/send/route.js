/**
 * Unified WhatsApp Template Sender API Endpoint
 * Location: app/api/whatsapp/send/route.js
 */

import { NextResponse } from 'next/server';
import * as templates from '@/lib/whatsapp/templates';
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
};

export async function POST(req) {
  // Check if WhatsApp is configured (either in env or DB)
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
    const { type, payload } = await req.json();

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

    // Call the corresponding sender function
    const result = await senderFn(payload);

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId
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
