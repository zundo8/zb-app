import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Authenticate session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch aggregate data from database
    const now = new Date();

    // Total Paid Sales Revenue
    const salesAggregate = await prisma.webStoreOrder.aggregate({
      where: {
        paymentStatus: "paid",
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
    console.error("[Web Store Stats API] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
