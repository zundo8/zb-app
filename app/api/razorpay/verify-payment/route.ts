import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment details' },
        { status: 400 }
      );
    }

    // Handle MOCK payment verification
    if (razorpay_order_id.startsWith('order_mock_') || razorpay_signature === 'mock_sig_valid') {
      console.warn('[Razorpay] Accepting MOCK payment verification for testing');
      return NextResponse.json({ success: true, payment_id: razorpay_payment_id, mock: true }, { status: 200 });
    }

    // Match credential resolution with /api/payment/* (dashboard DB preferred)
    let secret: string;
    try {
      secret = (await resolveRazorpayCredentials()).key_secret;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Payment verification not configured. Please set Razorpay keys in Settings or environment.' },
        { status: 500 }
      );
    }

    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Timing-safe comparison
    try {
      const sigBuffer = Buffer.from(razorpay_signature, 'utf-8');
      const genBuffer = Buffer.from(generated_signature, 'utf-8');
      
      if (sigBuffer.length !== genBuffer.length || !crypto.timingSafeEqual(sigBuffer, genBuffer)) {
        return NextResponse.json({ success: false, error: 'Signature mismatch' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid payment signature' }, { status: 400 });
    }

    return NextResponse.json({ success: true, payment_id: razorpay_payment_id }, { status: 200 });
  } catch (err: any) {
    console.error('Razorpay verification failed:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
