/**
 * WhatsApp Recipients Audience Segment Fetch Endpoint
 * Location: app/api/whatsapp/recipients/route.js
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isOptedIn } from '@/lib/whatsapp/templates';
import { formatPhone } from '@/lib/whatsapp/client';
import { shopifyFetch } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const audience = searchParams.get('audience') || 'all_customers';

    let customers = [];

    if (audience === 'all_customers') {
      customers = await prisma.customer.findMany({
        where: { phone: { not: null } }
      });
    } else if (audience === 'with_orders') {
      customers = await prisma.customer.findMany({
        where: {
          phone: { not: null },
          orders: { some: {} }
        }
      });
    } else if (audience === 'without_orders') {
      customers = await prisma.customer.findMany({
        where: {
          phone: { not: null },
          orders: { none: {} }
        }
      });
    } else if (audience === 'wishlist') {
      customers = await prisma.customer.findMany({
        where: {
          phone: { not: null },
          wishlist: { some: {} }
        }
      });
    } else if (audience === 'cart_abandonment') {
      // Fetch checkouts from Shopify API
      let shopifyCheckouts = [];
      try {
        const data = await shopifyFetch('checkouts.json', { limit: '50' });
        shopifyCheckouts = data?.checkouts || [];
      } catch (err) {
        console.warn('[Recipients API] Shopify checkout fetch failed:', err.message);
      }

      // Also fetch local carts from DB
      const localCarts = await prisma.cart.findMany({
        where: {
          customer: { phone: { not: null } },
          items: { some: {} }
        },
        include: { customer: true }
      });

      // Combine both sources
      const combinedPhones = new Set();
      const combinedCustomers = [];

      for (const c of shopifyCheckouts) {
        const phone = c.phone || c.billing_address?.phone;
        if (phone) {
          const formatted = formatPhone(phone);
          if (formatted && !combinedPhones.has(formatted)) {
            combinedPhones.add(formatted);
            combinedCustomers.push({
              id: String(c.id),
              name: `${c.billing_address?.first_name || ''} ${c.billing_address?.last_name || ''}`.trim() || 'Guest Customer',
              phone: phone
            });
          }
        }
      }

      for (const cart of localCarts) {
        const phone = cart.customer.phone;
        if (phone) {
          const formatted = formatPhone(phone);
          if (formatted && !combinedPhones.has(formatted)) {
            combinedPhones.add(formatted);
            combinedCustomers.push({
              id: cart.customer.id,
              name: cart.customer.name || 'Valued Customer',
              phone: phone
            });
          }
        }
      }

      customers = combinedCustomers;
    }

    // Map and filter by marketing opt-in consent
    const recipients = [];
    for (const c of customers) {
      const rawPhone = c.phone;
      if (!rawPhone) continue;

      const formatted = formatPhone(rawPhone);
      if (!formatted || formatted.length < 10) continue;

      // Check consent
      const consented = await isOptedIn(formatted);
      if (consented) {
        recipients.push({
          phone: formatted,
          customerName: c.name || c.customerName || 'there'
        });
      }
    }

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('[WhatsApp Recipients API] Error fetching opted-in customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
