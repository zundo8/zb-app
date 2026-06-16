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
    const { code, subtotal, paymentMethod } = body;

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
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "This coupon has reached its usage limit.",
      });
    }

    // Check minimum order amount
    const minOrderVal = Number(coupon.minOrderValue || 0);
    if (minOrderVal > 0 && subtotal < minOrderVal) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: `Minimum order of ₹${minOrderVal.toLocaleString("en-IN")} required.`,
      });
    }

    // Check payment method applicability
    const isCOD = paymentMethod?.toUpperCase() === "COD";

    if (coupon.applicability === "PREPAID_ONLY" && isCOD) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "This coupon is only valid for prepaid orders.",
      });
    }

    if (coupon.applicability === "COD_ONLY" && !isCOD) {
      return NextResponse.json({
        valid: false,
        discount: 0,
        discountType: "",
        message: "This coupon is only valid for COD orders.",
      });
    }

    // Determine discount rates based on payment method
    let currentDiscountType = coupon.discountType;
    let currentDiscountValue = Number(coupon.discountValue);

    if (coupon.applicability === "PREPAID_ONLY" || (coupon.applicability === "CUSTOM_RATES" && !isCOD)) {
      currentDiscountType = coupon.prepaidDiscountType;
      currentDiscountValue = Number(coupon.prepaidDiscountValue);
    } else if (coupon.applicability === "COD_ONLY" || (coupon.applicability === "CUSTOM_RATES" && isCOD)) {
      currentDiscountType = coupon.codDiscountType;
      currentDiscountValue = Number(coupon.codDiscountValue);
    }

    // Calculate discount
    let discount = 0;
    if (currentDiscountType === "percentage") {
      discount = Math.round((subtotal * currentDiscountValue) / 100);
    } else {
      discount = Math.min(currentDiscountValue, subtotal);
    }

    // Format display message
    let displayMessage = "";
    if (coupon.applyAsStoreCredit) {
      displayMessage = currentDiscountType === "percentage"
        ? `₹${discount.toLocaleString("en-IN")} Store Credit cashback will be added!`
        : `₹${currentDiscountValue.toLocaleString("en-IN")} Store Credit cashback will be added!`;
    } else {
      displayMessage = currentDiscountType === "percentage"
        ? `${currentDiscountValue}% off applied!`
        : `₹${currentDiscountValue.toLocaleString("en-IN")} off applied!`;
    }

    return NextResponse.json({
      valid: true,
      discount,
      discountType: currentDiscountType,
      couponId: coupon.id,
      applyAsStoreCredit: coupon.applyAsStoreCredit,
      message: displayMessage,
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
