import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

import { getCorsHeaders, handleCorsOptions } from '@/lib/cors';

export async function OPTIONS(req: Request) {
  return handleCorsOptions(req);
}

/**
 * GET /api/app/payment/order-status?orderId=order_xxx
 *
 * Polls a Razorpay order to check whether a payment has been captured.
 * Used by the mobile UPI confirmation screen after Linking.openURL(upi://).
 *
 * Returns:
 *   status:    'created' | 'attempted' | 'paid'
 *   paymentId: string (only when status === 'paid')
 */
export async function GET(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId query parameter' },
        { status: 400, headers: corsHeaders },
      );
    }

    let { key_id, key_secret } = await resolveRazorpayCredentials();
    key_id = key_id.trim();
    key_secret = key_secret.trim();

    const razorpay = new Razorpay({ key_id, key_secret });

    // Fetch the order from Razorpay
    const order: any = await razorpay.orders.fetch(orderId);

    // If order is paid, also fetch the payments to get the payment_id
    let paymentId: string | null = null;
    if (order.status === 'paid') {
      try {
        const payments: any = await razorpay.orders.fetchPayments(orderId);
        const captured = (payments.items || payments || []).find(
          (p: any) => p.status === 'captured',
        );
        paymentId = captured?.id || null;
      } catch {
        // Non-critical — we still know it's paid
      }
    }

    return NextResponse.json(
      {
        status: order.status, // 'created' | 'attempted' | 'paid'
        amount: order.amount,
        paymentId,
      },
      { headers: corsHeaders },
    );
  } catch (err: any) {
    console.error('[order-status] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch order status' },
      { status: 500, headers: corsHeaders },
    );
  }
}
