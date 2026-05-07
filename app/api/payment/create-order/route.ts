import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    let key_id = process.env.RAZORPAY_KEY_ID;
    let key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || key_id.includes('xxxx') || !key_secret || key_secret.includes('xxxx')) {
      try {
        const shop = await prisma.shop.findFirst({
          select: { razorpayKeyId: true, razorpayKeySecret: true }
        });
        if (shop?.razorpayKeyId && shop?.razorpayKeySecret) {
          key_id = shop.razorpayKeyId;
          key_secret = shop.razorpayKeySecret;
        }
      } catch (dbErr) {
        console.error('DB fetch error for Razorpay keys:', dbErr);
      }
    }

    if (!key_id || key_id.includes('xxxx')) {
      throw new Error('Razorpay keys not configured');
    }

    const instance = new Razorpay({
      key_id,
      key_secret: key_secret!,
    });
    const { amount, currency = 'INR', receipt } = await req.json();
    const order = await instance.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt,
    });
    return NextResponse.json(
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id, // Return the exact key used to create the order
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (err: any) {
    console.error('Razorpay create-order error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
