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

    // SECURE MOCK MODE: Allow testing if keys are not configured
    const isMissingKeys = !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('xxxx');
    
    if (isMissingKeys) {
      console.warn('⚠️ Razorpay Keys missing - Entering MOCK MODE');
      return NextResponse.json({ 
        id: `order_mock_${Date.now()}`,
        amount: Math.round(Number(amount) * 100),
        currency,
        receipt,
        mock: true,
        message: 'Razorpay Authentication Failed: key_secret is missing. Using MOCK ORDER for testing.'
      }, { status: 200 });
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
