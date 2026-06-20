import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  try {
    const discounts = await db.discount.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, discounts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      code, 
      type, 
      value, 
      minOrderAmount, 
      maxDiscount, 
      endDate, 
      usageLimit, 
      isActive, 
      description,
      cashbackEnabled,
      cashbackType,
      cashbackValue
    } = body;

    if (!code || !type || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const discount = await db.$transaction(async (tx) => {
      const d = await tx.discount.create({
        data: {
          code: code.toUpperCase().trim(),
          type,
          value: parseFloat(value),
          minOrderAmount: parseFloat(minOrderAmount || 0),
          maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
          endDate: endDate ? new Date(endDate) : null,
          usageLimit: usageLimit ? parseInt(usageLimit) : null,
          isActive: isActive !== undefined ? isActive : true,
          description,
          cashbackEnabled: cashbackEnabled !== undefined ? !!cashbackEnabled : false,
          cashbackType: cashbackType || "percentage",
          cashbackValue: cashbackValue ? parseFloat(cashbackValue) : 0,
        },
      });

      // Synchronize storefront coupon
      const formattedCode = d.code;
      const existing = await tx.webStoreCoupon.findUnique({
        where: { code: formattedCode },
      });

      if (!existing) {
        await tx.webStoreCoupon.create({
          data: {
            code: formattedCode,
            discountType: type,
            discountValue: parseFloat(value),
            minOrderValue: parseFloat(minOrderAmount || 0),
            usageLimit: usageLimit ? parseInt(usageLimit) : null,
            usedCount: 0,
            validFrom: new Date(),
            validUntil: endDate ? new Date(endDate) : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years fallback
            isActive: isActive !== undefined ? isActive : true,
            applicability: "ALL",
            prepaidDiscountType: "percentage",
            prepaidDiscountValue: 0,
            codDiscountType: "percentage",
            codDiscountValue: 0,
            applyAsStoreCredit: false,
            cashbackEnabled: cashbackEnabled !== undefined ? !!cashbackEnabled : false,
            cashbackType: cashbackType || "percentage",
            cashbackValue: cashbackValue ? parseFloat(cashbackValue) : 0,
          },
        });
      }

      return d;
    });

    return NextResponse.json({ success: true, discount });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Discount code already exists' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await db.$transaction(async (tx) => {
      const d = await tx.discount.findUnique({ where: { id } });
      if (!d) return;

      // Delete corresponding web store coupon
      await tx.webStoreCoupon.deleteMany({
        where: { code: d.code },
      });

      // Delete the discount
      await tx.discount.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
