import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const now = new Date();

  if (!supabaseUrl || !supabaseAnonKey) {
    try {
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
      const validCoupons = coupons.filter((coupon) => {
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return false;
        }
        return true;
      });
      return NextResponse.json({ coupons: validCoupons });
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message || "Internal server error" },
        { status: 500 }
      );
    }
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/web_store_coupons?select=*&is_active=eq.true&valid_from=lte.${now.toISOString()}&valid_until=gte.${now.toISOString()}&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: ['coupons'] },
      }
    );

    if (!res.ok) {
      throw new Error(`REST fetch failed: ${res.statusText}`);
    }

    const rawCoupons = await res.json();
    const coupons = rawCoupons.map((c: any) => ({
      id: c.id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minOrderValue: c.min_order_value,
      usageLimit: c.usage_limit,
      usedCount: c.used_count,
      validFrom: c.valid_from,
      validUntil: c.valid_until,
      isActive: c.is_active,
      createdAt: c.created_at,
      applicability: c.applicability,
      prepaidDiscountType: c.prepaid_discount_type,
      prepaidDiscountValue: c.prepaid_discount_value,
      codDiscountType: c.cod_discount_type,
      codDiscountValue: c.cod_discount_value,
      applyAsStoreCredit: c.apply_as_store_credit,
      cashbackEnabled: c.cashback_enabled,
      cashbackType: c.cashback_type,
      cashbackValue: c.cashback_value,
    }));

    const validCoupons = coupons.filter((coupon: any) => {
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return false;
      }
      return true;
    });

    return NextResponse.json({ coupons: validCoupons });
  } catch (error: any) {
    console.error("[Storefront Active Coupons GET] Supabase fetch failed, falling back to Prisma:", error.message);
    try {
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
      const validCoupons = coupons.filter((coupon) => {
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return false;
        }
        return true;
      });
      return NextResponse.json({ coupons: validCoupons });
    } catch (fallbackError: any) {
      return NextResponse.json(
        { error: fallbackError?.message || "Internal server error" },
        { status: 500 }
      );
    }
  }
}
