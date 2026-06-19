import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const coupons = await prisma.webStoreCoupon.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Filter coupons whose usage limit is reached
    const validCoupons = coupons.filter((coupon) => {
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ coupons: validCoupons });
  } catch (error: any) {
    console.error("[Storefront Active Coupons GET] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
