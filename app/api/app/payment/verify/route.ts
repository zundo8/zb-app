import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

const corsJsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsJsonHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Missing payment fields' },
        { status: 400, headers: corsJsonHeaders }
      );
    }
    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const { key_secret } = await resolveRazorpayCredentials();
    const secret = key_secret.trim();

    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (!valid) {
      console.error('Razorpay signature mismatch:', {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        received_sig: razorpay_signature,
        expected_sig: expected
      });
    }

    if (valid) {
      return NextResponse.json({ success: true }, { headers: corsJsonHeaders });
    }

    return NextResponse.json(
      { success: false, error: 'Signature mismatch' },
      { status: 400, headers: corsJsonHeaders }
    );
  } catch (err: unknown) {
    console.error('Razorpay verification error:', err);
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: corsJsonHeaders }
    );
  }
}
