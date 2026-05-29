import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * POST /api/storefront/coupons/validate
 * Public API — validates a coupon code against the WebStoreCoupon table.
 * Accepts: { code: string, subtotal: number }
 * Returns: { valid: boolean, discount: number, discountType: string, message: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, subtotal } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "Please enter a coupon code.",
      });
    }

    const coupon = await prisma.webStoreCoupon.findFirst({
      where: {
        code: code.toUpperCase().trim(),
        isActive: true,
      },
    });

    if (!coupon) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "Invalid coupon code.",
      });
    }

    // Check date validity
    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "This coupon is not yet active.",
      });
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "This coupon has expired.",
      });
    }

    // Check usage limit
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "This coupon has reached its usage limit.",
      });
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: `Minimum order of ₹${coupon.minOrderAmount.toLocaleString("en-IN")} required.`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = Math.round((subtotal * coupon.discountValue) / 100);
    } else {
      discount = Math.min(coupon.discountValue, subtotal);
    }

    return NextResponse.json({
      valid: true,
      discount,
      discountType: coupon.discountType,
      couponId: coupon.id,
      message: coupon.discountType === "percentage"
        ? `${coupon.discountValue}% off applied!`
        : `₹${coupon.discountValue.toLocaleString("en-IN")} off applied!`,
    });
  } catch (error: any) {
    console.error("[Coupon Validate API] Error:", error.message);
    return NextResponse.json({
      valid: false,
      discount: 0,
      discountType: "",
      message: "Unable to validate coupon. Please try again.",
    });
  }
}
