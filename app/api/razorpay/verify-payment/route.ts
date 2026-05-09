import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import { VerifyPaymentSchema } from '@/lib/razorpay-schemas';
import { paymentLog } from '@/lib/payment-logger';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = VerifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing payment details', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    // Handle MOCK payment verification for testing
    if (razorpay_order_id.startsWith('order_mock_') || razorpay_signature === 'mock_sig_valid') {
      paymentLog('warn', 'verify-payment', { orderId: razorpay_order_id, message: 'Mock verification' });
      return NextResponse.json({ success: true, payment_id: razorpay_payment_id, mock: true });
    }

    let secret: string;
    try {
      secret = (await resolveRazorpayCredentials()).key_secret;
    } catch {
      return NextResponse.json({ success: false, error: 'Razorpay not configured.' }, { status: 500 });
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Timing-safe comparison
    try {
      const sigBuf = Buffer.from(razorpay_signature, 'utf-8');
      const genBuf = Buffer.from(expectedSig, 'utf-8');
      if (sigBuf.length !== genBuf.length || !crypto.timingSafeEqual(sigBuf, genBuf)) {
        paymentLog('warn', 'verify-payment', { orderId: razorpay_order_id, paymentId: razorpay_payment_id, status: 'signature_mismatch' });
        return NextResponse.json({ success: false, error: 'Signature mismatch' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid payment signature' }, { status: 400 });
    }

    // Update order in DB
    try {
      await prisma.order.updateMany({
        where: { razorpayOrderId: razorpay_order_id },
        data: { paymentStatus: 'PAID', status: 'CONFIRMED', razorpayPaymentId: razorpay_payment_id, paymentCapturedAt: new Date() },
      });
    } catch (dbErr) {
      paymentLog('error', 'verify-payment', { orderId: razorpay_order_id, error: 'DB update failed' });
    }

    paymentLog('info', 'verify-payment', { orderId: razorpay_order_id, paymentId: razorpay_payment_id, status: 'verified' });
    return NextResponse.json({ success: true, payment_id: razorpay_payment_id });
  } catch (err: any) {
    paymentLog('error', 'verify-payment', { error: err.message });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
