/**
 * Shopify Order Created Webhook Endpoint
 * Location: app/api/shopify/orders/created/route.js
 */

import { NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-webhooks';
import { sendOrderConfirmation } from '@/lib/whatsapp/templates';
import { getWhatsAppSetting } from '@/lib/whatsapp/logger';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';

    // Verify Shopify HMAC Signature
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.warn('[Shopify Orders Created Webhook] Signature validation failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check setting toggle in settings table
    const isEnabled = await getWhatsAppSetting('order_confirmed', 'true') === 'true';
    if (!isEnabled) {
      console.log('[Shopify Orders Created Webhook] Trigger is disabled by settings toggle.');
      return NextResponse.json({ skipped: 'disabled' });
    }

    const payload = JSON.parse(rawBody);

    const phone = payload.customer?.phone || payload.billing_address?.phone;
    if (!phone) {
      console.log('[Shopify Orders Created Webhook] Skipped: customer phone not found.');
      return NextResponse.json({ skipped: 'no_phone' });
    }

    const customerName = payload.customer?.first_name || payload.billing_address?.first_name || 'there';
    const orderId = payload.order_number || payload.id;
    const orderTotal = payload.total_price || '0';

    const result = await sendOrderConfirmation({
      phone,
      customerName,
      orderId,
      orderTotal
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId
    });
  } catch (error) {
    console.error('[Shopify Orders Created Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
