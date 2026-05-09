import { NextResponse } from 'next/server';
import { razorpay } from '@/lib/razorpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentId, amount, currency = 'INR' } = body;

    if (!paymentId || !amount) {
      return NextResponse.json({ error: 'Missing paymentId or amount' }, { status: 400 });
    }

    const capture = await razorpay.payments.capture(paymentId, amount, currency);

    return NextResponse.json(capture);
  } catch (err: any) {
    console.error('Razorpay capture failed:', err);
    return NextResponse.json(
      { error: err?.error?.description || err?.message || 'Capture failed' },
      { status: 500 }
    );
  }
}
