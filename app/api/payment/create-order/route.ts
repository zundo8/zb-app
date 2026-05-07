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

function razorpayErrMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { error?: { description?: string; code?: string }; message?: string };
    if (e.error?.description) return e.error.description;
    if (e.message) return e.message;
  }
  return 'Order creation failed';
}

export async function POST(req: Request) {
  try {
    let key_id = process.env.RAZORPAY_KEY_ID;
    let key_secret = process.env.RAZORPAY_KEY_SECRET;

    const needsDbKeys =
      !key_id ||
      key_id.includes('xxxx') ||
      !key_secret ||
      key_secret.includes('xxxx');

    if (needsDbKeys) {
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
      throw new Error('Razorpay keys not configured (missing KEY_ID)');
    }
    if (!key_secret || key_secret.includes('xxxx')) {
      throw new Error('Razorpay keys not configured (missing KEY_SECRET)');
    }

    const instance = new Razorpay({
      key_id,
      key_secret,
    });

    const body = await req.json();
    const { amount, currency = 'INR', receipt: receiptIn } = body;
    const amountRupees = Number(amount);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Razorpay receipt: required, max 40 chars
    let receipt = typeof receiptIn === 'string' && receiptIn.trim() ? receiptIn.trim() : `zb_${Date.now()}`;
    if (receipt.length > 40) {
      receipt = receipt.slice(0, 40);
    }

    const order = await instance.orders.create({
      amount: Math.round(amountRupees * 100),
      currency,
      receipt,
      payment_capture: true,
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
  } catch (err: unknown) {
    console.error('Razorpay create-order error:', err);
    const message = err instanceof Error ? err.message : razorpayErrMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
