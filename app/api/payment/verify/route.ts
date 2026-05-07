import crypto from 'crypto';
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment fields' },
        { status: 400 }
      );
    }
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    
    let key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret || key_secret.includes('xxxx')) {
      try {
        const shop = await prisma.shop.findFirst({ select: { razorpayKeySecret: true } });
        key_secret = shop?.razorpayKeySecret || '';
      } catch (e) {
        console.error('DB fetch error for Razorpay keys:', e);
      }
    }
    
    if (!key_secret || key_secret.includes('xxxx')) {
      return NextResponse.json({ success: false, error: 'Razorpay keys not configured' }, { status: 500 });
    }

    const expected = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (valid) {
      return NextResponse.json(
        { success: true },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Signature mismatch' },
      {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (err: any) {
    console.error('Razorpay verification error:', err);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 400 });
  }
}
