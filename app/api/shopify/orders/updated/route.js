/**
 * Shopify Order Updated Webhook Endpoint
 * Location: app/api/shopify/orders/updated/route.js
 */

import { NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-webhooks';
import { sendOrderStatus } from '@/lib/whatsapp/templates';
import { getWhatsAppSetting } from '@/lib/whatsapp/logger';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';

    // Verify Shopify HMAC Signature
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.warn('[Shopify Orders Updated Webhook] Signature validation failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check setting toggle in settings table
    const isEnabled = await getWhatsAppSetting('order_status', 'true') === 'true';
    if (!isEnabled) {
      console.log('[Shopify Orders Updated Webhook] Trigger is disabled by settings toggle.');
      return NextResponse.json({ skipped: 'disabled' });
    }

    const payload = JSON.parse(rawBody);

    const phone = payload.customer?.phone || payload.billing_address?.phone;
    if (!phone) {
      console.log('[Shopify Orders Updated Webhook] Skipped: customer phone not found.');
      return NextResponse.json({ skipped: 'no_phone' });
    }

    const customerName = payload.customer?.first_name || payload.billing_address?.first_name || 'there';
    const orderId = payload.order_number || payload.id;
    
    // Map Shopify fulfillment/financial status to human-readable status
    let status = 'Processing';
    let extraInfo = 'We will notify you of any further updates.';
    
    const fulfillmentStatus = payload.fulfillment_status;
    const financialStatus = payload.financial_status;

    if (payload.cancelled_at) {
      status = 'Cancelled';
      extraInfo = 'Your order has been cancelled. Any refund due will be processed shortly.';
      
      // Update local database order status to cancelled and trigger refund
      try {
        const orderIdStr = String(payload.id);
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyOrderId: orderIdStr }
        });
        if (existingOrder && existingOrder.status !== 'cancelled') {
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              status: 'cancelled',
              paymentStatus: existingOrder.paymentStatus === 'paid' ? 'paid' : 'cancelled',
              fulfillmentStatus: 'cancelled',
              deliveryStatus: 'cancelled',
              updatedAt: new Date()
            }
          });
          console.log(`[Shopify Orders Updated Webhook] Order ${existingOrder.id} marked cancelled in DB`);
          
          const { processOrderRefund } = await import('@/lib/services/refundService');
          await processOrderRefund(existingOrder.id);
        }
      } catch (dbErr) {
        console.error('[Shopify Orders Updated Webhook] DB update or refund failed:', dbErr);
      }
    } else if (fulfillmentStatus === 'fulfilled') {
      status = 'Shipped';
      extraInfo = 'Your tracking details will follow in a separate message shortly.';
    } else if (fulfillmentStatus === 'partial') {
      status = 'Partially Shipped';
      extraInfo = 'Part of your order is on its way. The rest will follow soon.';
    } else if (financialStatus === 'refunded') {
      status = 'Refunded';
      extraInfo = 'Your refund has been processed. It should reflect in 5-7 business days.';
    } else if (financialStatus === 'paid') {
      status = 'Paid / Confirmed';
      extraInfo = 'We are preparing your item(s) for shipment.';
    }

    const result = await sendOrderStatus({
      phone,
      customerName,
      orderId,
      status,
      extraInfo,
      orderStatusUrl: payload.order_status_url || ''
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId
    });
  } catch (error) {
    console.error('[Shopify Orders Updated Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
