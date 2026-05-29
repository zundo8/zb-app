import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH: Update coupon details
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      code,
      discountType,
      discountValue,
      minOrderValue,
      usageLimit,
      validFrom,
      validUntil,
      isActive
    } = body;

    const coupon = await prisma.webStoreCoupon.findUnique({
      where: { id: params.id },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const data: any = {};
    if (code !== undefined) data.code = String(code).toUpperCase().trim();
    if (discountType !== undefined) data.discountType = discountType;
    if (discountValue !== undefined) data.discountValue = parseFloat(discountValue);
    if (minOrderValue !== undefined) data.minOrderValue = parseFloat(minOrderValue);
    if (usageLimit !== undefined) data.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (validFrom !== undefined) data.validFrom = new Date(validFrom);
    if (validUntil !== undefined) data.validUntil = new Date(validUntil);
    if (isActive !== undefined) data.isActive = isActive;

    const updatedCoupon = await prisma.webStoreCoupon.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (error: any) {
    console.error("[Web Store Single Coupon PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete coupon
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coupon = await prisma.webStoreCoupon.findUnique({
      where: { id: params.id },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    await prisma.webStoreCoupon.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Coupon deleted successfully" });
  } catch (error: any) {
    console.error("[Web Store Single Coupon DELETE] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
