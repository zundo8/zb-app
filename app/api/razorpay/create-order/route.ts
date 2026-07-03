import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import { CreateOrderSchema } from '@/lib/razorpay-schemas';
import { rateLimit } from '@/lib/rate-limit';
import { paymentLog } from '@/lib/payment-logger';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, remaining } = await rateLimit(ip, { maxRequests: 10, windowMs: 60_000 });

  if (!allowed) {
    paymentLog('warn', 'create-order', { ip, message: 'Rate limit exceeded' });
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      paymentLog('warn', 'create-order', { ip, message: 'Validation failed', error: JSON.stringify(errors) });
      return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
    }

    const { amount, currency, receipt, notes } = parsed.data;

    const { key_id, key_secret } = await resolveRazorpayCredentials();
    const razorpay = new Razorpay({ key_id, key_secret });

    let safeReceipt = receipt || `rcpt_${Date.now()}`;
    if (safeReceipt.length > 40) safeReceipt = safeReceipt.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: safeReceipt,
      notes: notes || {},
      payment_capture: true,
    });

    paymentLog('info', 'create-order', { orderId: order.id, status: 'created', ip });
    return NextResponse.json(order, { status: 200 });
  } catch (err: any) {
    paymentLog('error', 'create-order', { ip, error: err?.message });
    return NextResponse.json(
      { error: err?.error?.description || err?.message || 'Order creation failed' },
      { status: 500 },
    );
  }
}
