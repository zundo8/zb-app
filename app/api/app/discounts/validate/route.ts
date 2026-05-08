import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, orderAmount } = body;

    if (!code) {
      return NextResponse.json({ success: false, error: 'Discount code is required' }, { status: 400 });
    }

    const discount = await db.discount.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!discount) {
      return NextResponse.json({ success: false, error: 'Invalid discount code' }, { status: 404 });
    }

    if (!discount.isActive) {
      return NextResponse.json({ success: false, error: 'Discount code is no longer active' }, { status: 400 });
    }

    const now = new Date();
    if (discount.startDate > now) {
      return NextResponse.json({ success: false, error: 'Discount code is not yet active' }, { status: 400 });
    }

    if (discount.endDate && discount.endDate < now) {
      return NextResponse.json({ success: false, error: 'Discount code has expired' }, { status: 400 });
    }

    if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
      return NextResponse.json({ success: false, error: 'Discount code usage limit reached' }, { status: 400 });
    }

    if (orderAmount < discount.minOrderAmount) {
      return NextResponse.json({ 
        success: false, 
        error: `Minimum order amount for this code is ₹${discount.minOrderAmount}` 
      }, { status: 400 });
    }

    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (orderAmount * discount.value) / 100;
      if (discount.maxDiscount !== null && discountAmount > discount.maxDiscount) {
        discountAmount = discount.maxDiscount;
      }
    } else {
      discountAmount = discount.value;
    }

    return NextResponse.json({
      success: true,
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        discountAmount: Math.min(discountAmount, orderAmount),
      }
    });
  } catch (error: any) {
    console.error('Discount validation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
