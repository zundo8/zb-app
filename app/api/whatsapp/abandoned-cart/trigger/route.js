/**
 * WhatsApp Abandoned Cart Trigger API Endpoint
 * Location: app/api/whatsapp/abandoned-cart/trigger/route.js
 */

import { NextResponse } from 'next/server';
import { sendAbandonedCart } from '@/lib/whatsapp/templates';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

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
    const body = await req.json();
    const checkout = body.checkout || body;

    const phone = checkout.phone || checkout.billing_address?.phone || checkout.customer?.phone;

    if (!phone) {
      return NextResponse.json({ skipped: 'no_phone' });
    }

    const customerName = checkout.billing_address?.first_name 
      || checkout.customer?.name?.split(' ')[0] 
      || checkout.customerName 
      || 'there';
      
    const itemCount = checkout.line_items?.length 
      || checkout.items?.length 
      || checkout.itemCount 
      || 0;
      
    const cartTotal = checkout.total_price 
      || checkout.subtotal 
      || checkout.cartTotal 
      || '0.00';
      
    const checkoutUrl = checkout.abandoned_checkout_url 
      || `https://app.zicabella.com/cart?recover=${checkout.id}`;

    const firstItem = checkout.line_items?.[0] || checkout.items?.[0] || {};
    const productImageUrl = firstItem.image_url || firstItem.image || '';
    const productName = firstItem.title || '';

    const result = await sendAbandonedCart({
      phone,
      customerName,
      itemCount,
      cartTotal,
      checkoutUrl,
      productImageUrl,
      productName
    });

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('[WhatsApp Abandoned Cart Trigger] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
