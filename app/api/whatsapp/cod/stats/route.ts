/**
 * WhatsApp COD Verification Stats API Route
 * Location: app/api/whatsapp/cod/stats/route.ts
 */

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Pending Confirm Count
    const pendingCount = await db.order.count({
      where: { codConfirmationStatus: 'pending' }
    });

    // 2. Confirmed Today Count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const confirmedTodayCount = await db.order.count({
      where: {
        codConfirmationStatus: 'confirmed',
        codConfirmedAt: { gte: todayStart }
      }
    });

    // 3. Auto Cancelled Count
    const cancelledCount = await db.order.count({
      where: {
        codConfirmationStatus: { in: ['cancelled', 'cancelled_by_customer'] }
      }
    });

    // 4. Calculate Average Response Time
    const respondedOrders = await db.order.findMany({
      where: {
        codConfirmationStatus: { in: ['confirmed', 'cancelled_by_customer'] },
        codConfirmedAt: { not: null }
      },
      select: {
        createdAt: true,
        codConfirmedAt: true
      }
    });

    let totalResponseTimeMs = 0;
    let respondedCount = 0;

    for (const order of respondedOrders) {
      if (order.codConfirmedAt) {
        const diff = order.codConfirmedAt.getTime() - order.createdAt.getTime();
        if (diff > 0) {
          totalResponseTimeMs += diff;
          respondedCount++;
        }
      }
    }

    const avgResponseTimeMin = respondedCount > 0 
      ? Math.round((totalResponseTimeMs / respondedCount) / 60000) 
      : 0;

    const stats = [
      { label: "Pending Confirm", value: String(pendingCount), color: "text-amber-500" },
      { label: "Confirmed Today", value: String(confirmedTodayCount), color: "text-emerald-500" },
      { label: "Auto Cancelled", value: String(cancelledCount), color: "text-rose-500" },
      { label: "Avg Response Time", value: respondedCount > 0 ? `${avgResponseTimeMin}m` : '0m', color: "text-blue-500" },
    ];

    // 5. Fetch Recent COD Verifications list
    const recentOrders = await db.order.findMany({
      where: {
        codConfirmationStatus: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        customer: true
      }
    });

    const verifications = recentOrders.map((o: any) => ({
      id: o.id,
      shopifyOrderId: o.shopifyOrderId || o.id,
      customerName: o.customer?.name || 'Customer',
      amount: `₹${o.totalPrice.toLocaleString('en-IN')}`,
      riskScore: o.rtoRiskScore || 0,
      status: o.codConfirmationStatus || 'pending'
    }));

    return NextResponse.json({ stats, verifications });

  } catch (error: any) {
    console.error('[WhatsApp COD Stats API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
