/**
 * Shopify Abandoned Carts API Route
 * Location: app/api/shopify/carts/abandoned/route.js
 */

import { NextResponse } from 'next/server';
import { shopifyFetch } from '@/lib/shopify-admin';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let checkouts = [];
    try {
      const data = await shopifyFetch('checkouts.json', { limit: '50' });
      checkouts = data?.checkouts || [];
    } catch (apiErr) {
      console.warn('[Shopify Carts API] Live fetch failed:', apiErr.message);
    }

    // Cross reference with local whatsapp_messages database to see which ones are already sent
    const sentPhones = new Set();
    try {
      const logs = await prisma.whatsAppMessage.findMany({
        where: {
          templateName: { in: ['zica_cart_recovery_v1', 'zb_abandoned_cart'] },
          status: 'sent'
        },
        select: { phoneNumber: true },
        distinct: ['phoneNumber']
      });
      if (logs && Array.isArray(logs)) {
        logs.forEach(l => sentPhones.add(l.phoneNumber));
      }
    } catch (dbErr) {
      console.warn('[Shopify Carts API] Failed to fetch sent recovery logs:', dbErr.message);
    }

    const carts = checkouts.map(c => {
      const phone = c.phone || c.billing_address?.phone || '';
      const formatted = phone ? formatPhone(phone) : '';
      const isSent = formatted ? sentPhones.has(formatted) : false;

      const itemsList = c.line_items
        ?.map(item => `${item.title} (x${item.quantity || 1})`)
        .join(', ') || 'Cart Items';

      return {
        id: String(c.id),
        customer: `${c.billing_address?.first_name || ''} ${c.billing_address?.last_name || ''}`.trim() || 'Guest Customer',
        phone: phone,
        cart_value: `₹${parseFloat(c.total_price || '0').toLocaleString('en-IN')}`,
        items: itemsList,
        abandoned_at: c.created_at,
        status: isSent ? 'sent' : 'pending',
        abandoned_checkout_url: c.abandoned_checkout_url || ''
      };
    });

    return NextResponse.json({ carts });
  } catch (error) {
    console.error('[Shopify Carts API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

