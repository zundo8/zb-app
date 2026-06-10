import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-webhooks';
import { sendOrderConfirmationEmail } from '@/lib/services/orderEmailService';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');

    // 1. Verify Shopify HMAC signature
    if (!hmacHeader || !verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[Shopify Webhook] Invalid webhook signature');
      return NextResponse.json({ success: false, error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // 2. Parse the Shopify order payload
    const payload = JSON.parse(rawBody);

    // 3. Extract order details
    const orderId = payload.name || payload.id?.toString() || 'N/A';

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
    const currency = payload.currency || 'INR';
    const orderDate = payload.created_at ? new Date(payload.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' }) : undefined;

    console.log(`[Shopify Webhook] Triggering confirmation email for order ${orderId} (Email: ${customerEmail})`);

    // 4. Call sendOrderConfirmationEmail() with the extracted data (non-blocking)
    sendOrderConfirmationEmail({
      orderId,
      customerEmail,
      customerName,
      items,
      total,
      currency,
      orderDate,
    }).catch(err => {
      console.error('[Shopify Webhook] sendOrderConfirmationEmail async error:', err);
    });

    // 5. Return 200 immediately
    return NextResponse.json({ success: true, message: 'Webhook received and processing' }, { status: 200 });
  } catch (error: any) {
    console.error('[Shopify Webhook Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
