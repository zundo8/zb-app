import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // TODO: mark this order as paid in your database using razorpay_order_id
      return NextResponse.json({ success: true, payment_id: razorpay_payment_id }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, error: 'Signature mismatch' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Razorpay verification failed:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
