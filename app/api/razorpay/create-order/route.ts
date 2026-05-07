import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

/**
 * Legacy mobile/admin endpoint — prefer POST /api/payment/create-order for new clients.
 * Uses the same credential resolution as payment routes (dashboard DB first).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency = 'INR', receipt: receiptIn } = body;

    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const { key_id, key_secret } = await resolveRazorpayCredentials();
    const razorpay = new Razorpay({ key_id, key_secret });

    let receipt =
      typeof receiptIn === 'string' && receiptIn.trim() ? receiptIn.trim() : `rcpt_${Date.now()}`;
    if (receipt.length > 40) receipt = receipt.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt,
      payment_capture: true,
    });
    return NextResponse.json(order, { status: 200 });
  } catch (err: any) {
    console.error('Razorpay order creation failed:', err);
    return NextResponse.json(
      { error: err?.error?.description || err?.message || 'Order creation failed' },
      { status: 500 }
    );
  }
}
