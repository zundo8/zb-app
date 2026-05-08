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
    const { code, type, value, minOrderAmount, maxDiscount, endDate, usageLimit, isActive, description } = body;

    if (!code || !type || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const discount = await db.discount.create({
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
      },
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

    await db.discount.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
