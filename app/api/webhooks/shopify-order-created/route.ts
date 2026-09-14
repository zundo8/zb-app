import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-webhooks';
import { sendOrderConfirmationEmail } from '@/lib/services/orderEmailService';
import prisma from '@/lib/db';
import { maskEmail } from '@/lib/pii-mask';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const webhookId = request.headers.get('x-shopify-webhook-id');
    const topic = request.headers.get('x-shopify-topic') || 'orders/create';

    // 1. Verify Shopify HMAC signature
    if (!hmacHeader || !verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[Shopify Webhook] Invalid webhook signature');
      return NextResponse.json({ success: false, error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // 2. Parse the Shopify order payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Shopify Webhook] Malformed JSON payload');
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // 3. Extract order details
    const orderId = payload.name || payload.id?.toString() || 'N/A';
    const eventIdentifier = webhookId || `shopify_order_${payload.id || orderId}`;

    // 4. Idempotency check: prevent processing duplicate webhook deliveries
    try {
      const existing = await prisma.webhookEvent.findFirst({
        where: {
          source: 'shopify',
          eventType: topic,
          payload: { contains: eventIdentifier },
          processed: true,
        },
      });

      if (existing) {
        console.log(`[Shopify Webhook] Duplicate webhook ${eventIdentifier} already processed, skipping`);
        return NextResponse.json({ success: true, duplicate: true, message: 'Already processed' }, { status: 200 });
      }
    } catch (dbErr) {
      console.warn('[Shopify Webhook] Idempotency lookup error:', dbErr);
    }

    // Record webhook event in database for idempotency & audit
    try {
      await prisma.webhookEvent.create({
        data: {
          source: 'shopify',
          eventType: topic,
          payload: JSON.stringify({
            webhookId: eventIdentifier,
            shopifyOrderId: payload.id,
            orderName: orderId,
            receivedAt: new Date().toISOString(),
          }),
          processed: true,
          processedAt: new Date(),
        },
      });
    } catch (createErr) {
      console.warn('[Shopify Webhook] Failed to record WebhookEvent:', createErr);
    }

    // If this is a WebStore order, skip sending confirmation email to avoid duplicate emails
    const tags = payload.tags || '';
    if (tags.includes('WebStoreOrder') || tags.includes('WebStore') || tags.includes('Web')) {
      console.log(`[Shopify Webhook] Skipping order confirmation for WebStore order ${orderId} (already handled at checkout)`);
      return NextResponse.json({ success: true, message: 'WebStore order, confirmation sent during checkout' }, { status: 200 });
    }
    const customerEmail = payload.email || payload.customer?.email;
    const customerName = payload.customer 
      ? `${payload.customer.first_name || ''} ${payload.customer.last_name || ''}`.trim() 
      : 'Valued Customer';
    
    if (!customerEmail) {
      console.warn('[Shopify Webhook] No customer email in order payload:', orderId);
      return NextResponse.json({ success: true, message: 'No customer email found, skipped' }, { status: 200 });
    }

    const items = (payload.line_items || []).map((item: any) => ({
      name: item.title || 'Product Item',
      size: item.variant_title || undefined,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
    }));

    const total = Number(payload.total_price || 0);
    const subtotal = Number(payload.subtotal_price || total);
    const shipping = Number(payload.total_shipping_price_set?.shop_money?.amount || payload.shipping_lines?.[0]?.price || 0);
    const discount = Number(payload.total_discounts || 0);
    const currency = payload.currency || 'INR';
    const orderDate = payload.created_at ? new Date(payload.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }) : undefined;
    const paymentMethod = payload.gateway || payload.payment_gateway_names?.[0] || 'Credit Card';

    const sa = payload.shipping_address;
    const shippingAddress = sa 
      ? `${sa.name ? sa.name + '\n' : ''}${sa.address1 || ''}${sa.address2 ? ', ' + sa.address2 : ''}\n${sa.city || ''}, ${sa.province || ''} - ${sa.zip || ''}\n${sa.country || ''}`
      : 'N/A';

    console.log(`[Shopify Webhook] Triggering confirmation email for order ${orderId} (Email: ${maskEmail(customerEmail)})`);

    // 5. Call sendOrderConfirmationEmail() with the extracted data (non-blocking)
    sendOrderConfirmationEmail({
      orderId,
      customerEmail,
      customerName,
      items,
      total,
      currency,
      orderDate,
      subtotal,
      shipping,
      discount,
      shippingAddress,
      paymentMethod,
    }).catch((err: any) => {
      console.error('[Shopify Webhook] sendOrderConfirmationEmail async error:', err);
    });

    // 6. Return 200 immediately
    return NextResponse.json({ success: true, message: 'Webhook received and processing' }, { status: 200 });
  } catch (error: any) {
    console.error('[Shopify Webhook Error]:', error);
    // Return 200 to prevent Shopify infinite retry loop on unrecoverable errors
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
