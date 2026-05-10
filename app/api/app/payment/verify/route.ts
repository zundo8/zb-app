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

    // Special case for headless payments processed via S2S
    if (razorpay_signature === 'HEADLESS') {
       return NextResponse.json({ success: true }, { headers: corsJsonHeaders });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    let secret: string;
    try {
      const creds = await resolveRazorpayCredentials();
      secret = creds.key_secret.trim();
    } catch (credErr: any) {
      console.error('[Verify] Credential resolution failed:', credErr.message);
      return NextResponse.json(
        { success: false, error: 'Payment gateway not configured. Please contact support.' },
        { status: 500, headers: corsJsonHeaders }
      );
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Both are hex strings — compare as plain UTF-8 to avoid Buffer.from('hex') crash
    // when Razorpay returns a signature with characters outside hex range
    let valid = false;
    try {
      const expectedBuf = Buffer.from(expected, 'utf8');
      const receivedBuf = Buffer.from(razorpay_signature, 'utf8');
      if (expectedBuf.length === receivedBuf.length) {
        valid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
      }
    } catch {
      valid = false;
    }

    if (!valid) {
      console.error('Razorpay signature mismatch:', {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        received_sig: razorpay_signature?.slice(0, 12) + '...',
        expected_sig: expected?.slice(0, 12) + '...',
      });
      return NextResponse.json(
        { success: false, error: 'Payment signature verification failed. Please try again.' },
        { status: 400, headers: corsJsonHeaders }
      );
    }

    console.log(`[Verify] ✅ Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);
    return NextResponse.json({ success: true, payment_id: razorpay_payment_id }, { headers: corsJsonHeaders });
  } catch (err: unknown) {
    console.error('Razorpay verification error:', err);
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: corsJsonHeaders }
    );
  }
}
