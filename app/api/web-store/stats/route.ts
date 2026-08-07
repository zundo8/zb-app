import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission('STOREFRONT', 'view');

    // 2. Fetch aggregate data from database
    const now = new Date();

    // Total Sales Revenue (Paid or COD Upfront Paid orders)
    const salesAggregate = await prisma.webStoreOrder.aggregate({
      where: {
        OR: [
          { paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "PAID", "COD_UPFRONT_PAID", "PARTIALLY_PAID"] } },
          { codUpfrontPaid: { gt: 0 } }
        ]
      },
      _sum: {
        totalAmount: true,
      },
    });
    const totalSales = Number(salesAggregate._sum.totalAmount || 0);

    // Total Web Orders Count
    const totalOrdersCount = await prisma.webStoreOrder.count();

    // Unfulfilled Orders (status: unfulfilled or processing or shipped)
    const unfulfilledCount = await prisma.webStoreOrder.count({
      where: {
        fulfillmentStatus: {
          in: ["unfulfilled", "processing", "shipped"],
        },
      },
    });

    // Active Coupons
    const activeCouponsCount = await prisma.webStoreCoupon.count({
      where: {
        isActive: true,
        validUntil: {
          gt: now,
        },
      },
    });

    // Active Banners
    const activeBannersCount = await prisma.webStoreBanner.count({
      where: {
        isActive: true,
      },
    });

    // Recent Orders (last 5)
    const recentOrders = await prisma.webStoreOrder.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Top Coupons by usage (last 5)
    const topCoupons = await prisma.webStoreCoupon.findMany({
      take: 5,
      orderBy: {
        usedCount: "desc",
      },
    });

    return NextResponse.json({
      metrics: {
        totalSales,
        totalOrdersCount,
        unfulfilledCount,
        activeCouponsCount,
        activeBannersCount,
      },
      recentOrders,
      topCoupons,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
