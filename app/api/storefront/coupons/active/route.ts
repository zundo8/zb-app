import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();

  try {
    const coupons = await prisma.webStoreCoupon.findMany({
      where: {
        isActive: true,
        isSecure: false,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    const validCoupons = coupons.filter((coupon: any) => {
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return false;
      }
      return true;
    });
    return NextResponse.json({ coupons: validCoupons });
  } catch (error: any) {
    console.error("[Storefront Active Coupons GET] Direct Prisma query failed:", error.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
