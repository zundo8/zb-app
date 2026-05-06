import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import prisma from '@/lib/db';

function getRazorpayInstance(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keyId && keySecret && !keyId.includes('xxxx') && !keySecret.includes('xxxx')) {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return null;
}

async function getRazorpayFromDB(): Promise<Razorpay | null> {
  try {
    const shop = await prisma.shop.findFirst({
      select: { razorpayKeyId: true, razorpayKeySecret: true },
    });
    if (shop?.razorpayKeyId && shop?.razorpayKeySecret) {
      return new Razorpay({
        key_id: shop.razorpayKeyId,
        key_secret: shop.razorpayKeySecret,
      });
    }
  } catch (e) {
    console.error('[Razorpay] DB key fetch error:', e);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency = 'INR', receipt } = body;

    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Try env vars first, then DB fallback
    let razorpay = getRazorpayInstance();
    
    if (!razorpay) {
      razorpay = await getRazorpayFromDB();
    }

    // If still no Razorpay instance, enter MOCK MODE for testing
    if (!razorpay) {
      console.warn('⚠️ Razorpay Keys missing - Entering MOCK MODE');
      return NextResponse.json({ 
        id: `order_mock_${Date.now()}`,
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt,
        mock: true,
        message: 'Razorpay keys not configured. Using MOCK ORDER for testing.'
      }, { status: 200 });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100), // convert to paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: true,
    });
    return NextResponse.json(order, { status: 200 });
  } catch (err: any) {
    console.error('Razorpay order creation failed:', err);
    return NextResponse.json(
      { error: err?.error?.description || err.message },
      { status: 500 }
    );
  }
}
