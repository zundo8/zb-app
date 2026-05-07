import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activeDevices = await db.deviceToken.count({
      where: { isActive: true }
    });

    const vipCount = await db.customer.count({
      where: { ordersCount: { gt: 3 } }
    });

    return NextResponse.json({
      success: true,
      activeDevices,
      vipCount
    });
  } catch (error: any) {
    console.error('Failed to fetch notification stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
