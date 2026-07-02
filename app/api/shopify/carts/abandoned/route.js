import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Fetch active carts that have been idle for > 30 minutes, or explicitly abandoned
    let localCarts = [];
    try {
      localCarts = await prisma.cart.findMany({
        where: {
          items: { some: {} },
          OR: [
            { status: 'abandoned' },
            { status: 'active', lastActivityAt: { lte: thirtyMinutesAgo } }
          ]
        },
        include: {
          customer: {
            select: {
              name: true,
              phone: true
            }
          },
          items: true
        },
        orderBy: {
          lastActivityAt: 'desc'
        },
        take: 50
      });
    } catch (apiErr) {
      console.warn('[First Party Carts API] Fetch failed:', apiErr.message);
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
      console.warn('[First Party Carts API] Failed to fetch sent recovery logs:', dbErr.message);
    }

    const carts = localCarts.map(c => {
      const phone = c.phone || c.customer?.phone || '';
      const formatted = phone ? formatPhone(phone) : '';
      const isSent = formatted ? sentPhones.has(formatted) : false;

      const itemsList = c.items
        ?.map(item => `${item.title} (x${item.quantity || 1})`)
        .join(', ') || 'Cart Items';

      return {
        id: c.id,
        customer: c.customer?.name || 'Guest Customer',
        phone: phone,
        cart_value: `₹${parseFloat(c.subtotal || 0).toLocaleString('en-IN')}`,
        items: itemsList,
        abandoned_at: c.lastActivityAt,
        status: isSent ? 'sent' : 'pending',
        abandoned_checkout_url: `https://zicabella.com/checkout?recover=${c.id}`
      };
    });

    return NextResponse.json({ carts });
  } catch (error) {
    console.error('[First Party Carts API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


