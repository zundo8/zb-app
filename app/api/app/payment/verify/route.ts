import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import prisma from '@/lib/db';

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
      console.error('[Verify] Missing fields:', { razorpay_order_id, razorpay_payment_id, has_signature: !!razorpay_signature });
      return NextResponse.json(
        { success: false, error: 'Missing payment fields' },
        { status: 400, headers: corsJsonHeaders }
      );
    }

    let secret: string;
    try {
      const creds = await resolveRazorpayCredentials();
      secret = creds.key_secret.trim();
    } catch (credErr: any) {
      console.error('[Verify] Credential resolution failed:', credErr.message);
      return NextResponse.json(
        { success: false, error: 'Payment gateway not configured correctly.' },
        { status: 500, headers: corsJsonHeaders }
      );
    }

    // Razorpay signature verification logic:
    // HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.error('[Verify] Signature mismatch:', {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        received: razorpay_signature.slice(0, 10) + '...',
        expected: expectedSignature.slice(0, 10) + '...',
      });
      return NextResponse.json(
        { success: false, error: 'Payment verification failed: Signature mismatch.' },
        { status: 400, headers: corsJsonHeaders }
      );
    }

    console.log(`[Verify] ✅ Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);

    // Update local order status immediately to avoid race conditions with webhook
    try {
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: razorpay_order_id }
      });
      if (order && order.paymentStatus !== 'paid') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'paid',
            razorpayPaymentId: razorpay_payment_id,
            paymentCapturedAt: new Date(),
            status: (order.status === 'PENDING' || order.status === 'awaiting_approval') ? 'OPEN' : order.status,
          }
        });
        
        // Record payment
        await prisma.payment.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            amount: order.totalPrice,
            type: 'CAPTURE',
            status: 'success',
            gateway: 'razorpay',
          }
        });
        console.log(`[Verify] Local order ${order.id} marked as PAID`);
      }
    } catch (dbErr: any) {
      console.warn('[Verify] Failed to update local order:', dbErr.message);
    }

    return NextResponse.json({ success: true, payment_id: razorpay_payment_id }, { headers: corsJsonHeaders });
  } catch (err: unknown) {
    console.error('[Verify] Internal Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error during verification' },
      { status: 500, headers: corsJsonHeaders }
    );
  }
}
