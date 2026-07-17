/**
 * WhatsApp Cart Recovery Conversion Stats API Route
 * Location: app/api/whatsapp/abandoned-cart/stats/route.ts
 */

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch all sent cart recovery messages
    const recoveryMessages = await db.whatsAppMessage.findMany({
      where: {
        templateName: { in: ['abandoned_cart_a1', 'abandoned_cart_a2', 'abandoned_cart_a3', 'zica_cart_recovery_v1', 'zb_abandoned_cart'] },
        status: { not: 'failed' }
      },
      orderBy: { createdAt: 'asc' }
    });

    const totalSent = recoveryMessages.length;
    const recoveredOrders = new Set<string>();
    let recoveredRevenue = 0;

    // 2. Cross-reference: check if a customer placed an order *after* a recovery message was sent
    for (const msg of recoveryMessages) {
      if (!msg.userId && !msg.phoneNumber) continue;

      const whereClause: any = {
        createdAt: { gte: msg.sentAt || msg.createdAt },
        status: { not: 'cancelled' } // do not count completely cancelled orders
      };

      if (msg.userId) {
        whereClause.customerId = msg.userId;
      } else {
        whereClause.customer = {
          phone: { contains: msg.phoneNumber.slice(-10) }
        };
      }

      const orders = await db.order.findMany({
        where: whereClause,
        select: { id: true, totalPrice: true }
      });

      for (const order of orders) {
        if (!recoveredOrders.has(order.id)) {
          recoveredOrders.add(order.id);
          recoveredRevenue += order.totalPrice;
        }
      }
    }

    const recoveryRate = totalSent > 0 ? (recoveredOrders.size / totalSent) * 100 : 0;

    return NextResponse.json({
      recoveredOrders: recoveredOrders.size,
      recoveredRevenue,
      recoveryRate: parseFloat(recoveryRate.toFixed(1)),
      totalSent
    });
  } catch (error: any) {
    console.error('[WhatsApp Cart Recovery Stats API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
