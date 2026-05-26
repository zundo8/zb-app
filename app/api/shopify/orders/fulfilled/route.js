/**
 * Shopify Order Fulfilled Webhook Endpoint
 * Location: app/api/shopify/orders/fulfilled/route.js
 */

import { NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-webhooks';
import { sendShippingUpdate } from '@/lib/whatsapp/templates';
import { getWhatsAppSetting } from '@/lib/whatsapp/logger';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';

    // Verify Shopify HMAC Signature
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.warn('[Shopify Orders Fulfilled Webhook] Signature validation failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check setting toggle in settings table
    const isEnabled = await getWhatsAppSetting('order_shipped', 'true') === 'true';
    if (!isEnabled) {
      console.log('[Shopify Orders Fulfilled Webhook] Trigger is disabled by settings toggle.');
      return NextResponse.json({ skipped: 'disabled' });
    }

    const payload = JSON.parse(rawBody);

    const phone = payload.customer?.phone || payload.billing_address?.phone;
    if (!phone) {
      console.log('[Shopify Orders Fulfilled Webhook] Skipped: customer phone not found.');
      return NextResponse.json({ skipped: 'no_phone' });
    }

    const customerName = payload.customer?.first_name || payload.billing_address?.first_name || 'there';
    const orderId = payload.order_number || payload.id;
    
    // Extract tracking details from fulfillments array
    const fulfillment = payload.fulfillments?.[0] || {};
    const courier = fulfillment.tracking_company || 'our shipping partner';
    const trackingNumber = fulfillment.tracking_number || 'TBA';
    
    // Format delivery estimate nicely
    let estimatedDelivery = '3-5 business days';
    if (fulfillment.estimated_delivery_at) {
      try {
        estimatedDelivery = new Date(fulfillment.estimated_delivery_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch (e) {
        console.warn('[Shopify Orders Fulfilled Webhook] Failed to parse estimated_delivery_at date:', e.message);
      }
    }

    const result = await sendShippingUpdate({
      phone,
      customerName,
      orderId,
      courier,
      trackingNumber,
      estimatedDelivery
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId
    });
  } catch (error) {
    console.error('[Shopify Orders Fulfilled Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
