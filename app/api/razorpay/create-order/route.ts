import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency = 'INR', receipt } = body;

    if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('xxxx')) {
      return NextResponse.json({ 
        error: 'Razorpay Authentication Failed: key_secret is missing or a placeholder. Please update .env.local.' 
      }, { status: 401 });
    }

    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
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
