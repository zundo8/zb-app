/**
 * WhatsApp Cart Recovery Automation Trigger API Route
 * Location: app/api/whatsapp/abandoned-cart/trigger-automation/route.ts
 */

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendAbandonedCart } from '@/lib/whatsapp/templates';
import { getConfig } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function POST() {
  const config = await getConfig();
  if (!config.configured) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 503 });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 3600000); // 1 hour ago
    const twentyFourHoursAgo = new Date(Date.now() - 86400000); // 24 hours ago

    // 1. Fetch active carts that have items and haven't been active for > 1 hour
    const inactiveCarts = await db.cart.findMany({
      where: {
        status: 'active',
        lastActivityAt: { lte: oneHourAgo },
        items: { some: {} },
        OR: [
          { phone: { not: null } },
          { customer: { phone: { not: null } } }
        ]
      },
      include: {
        customer: true,
        items: true
      }
    });

    const results = [];
    let sentCount = 0;

    for (const cart of inactiveCarts) {
      const phone = cart.phone || cart.customer?.phone;
      if (!phone) continue;

      // 2. Anti-spam: check if we sent a cart recovery template in the last 24 hours
      const recentRecovery = await db.whatsAppMessage.findFirst({
        where: {
          phoneNumber: phone,
          templateName: { in: ['zica_cart_recovery_v1', 'zb_abandoned_cart'] },
          createdAt: { gte: twentyFourHoursAgo }
        }
      });

      if (recentRecovery) {
        // Still mark the cart as abandoned in the DB even if skipped to keep statuses updated
        await db.cart.update({
          where: { id: cart.id },
          data: { status: 'abandoned', abandonedAt: new Date() }
        });
        results.push({ phone, status: 'skipped', reason: 'recently_sent' });
        continue;
      }

      // 3. Trigger sendAbandonedCart (includes consent checking and DB logging)
      const res = await sendAbandonedCart({
        phone,
        customerName: cart.customer?.name || 'there',
        checkoutUrl: `https://zicabella.com/checkout?recover=${cart.id}`
      });

      // Update cart status to 'abandoned' in DB
      await db.cart.update({
        where: { id: cart.id },
        data: { status: 'abandoned', abandonedAt: new Date() }
      });

      if (res.success) {
        sentCount++;
        results.push({ phone, status: 'sent', messageId: res.messageId });
      } else {
        results.push({ phone, status: 'failed', error: res.error });
      }
    }

    return NextResponse.json({
      success: true,
      scannedCarts: inactiveCarts.length,
      sentRecoveries: sentCount,
      results
    });
  } catch (error: any) {
    console.error('[WhatsApp Cart Recovery Automation] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
