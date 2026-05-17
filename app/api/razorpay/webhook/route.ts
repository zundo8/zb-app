import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import { paymentLog } from '@/lib/payment-logger';
import prisma from '@/lib/db';

/**
 * Razorpay Webhook Handler — Production-hardened.
 *
 * Key features:
 * - Reads raw body for signature verification
 * - Idempotency via WebhookEvent table
 * - Structured audit logging
 * - Returns 200 immediately to avoid Razorpay retries
 */

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      paymentLog('warn', 'webhook', { message: 'Missing signature or webhook secret' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify signature
    let isValid = false;
    try {
      isValid = Razorpay.validateWebhookSignature(body, signature, webhookSecret);
    } catch {
      isValid = false;
    }

    if (!isValid) {
      paymentLog('error', 'webhook', { message: 'Invalid webhook signature' });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const eventId = event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id || 'unknown';

    // Idempotency: check if already processed
    const existing = await prisma.webhookEvent.findFirst({
      where: { source: 'RAZORPAY', eventType, payload: { contains: eventId } },
    });

    if (existing?.processed) {
      paymentLog('info', 'webhook', { message: 'Duplicate event skipped', status: eventType });
      return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
    }

    // Log event for audit
    const webhookRecord = await prisma.webhookEvent.create({
      data: { source: 'RAZORPAY', eventType, payload: body },
    });

    paymentLog('info', 'webhook', { message: `Received: ${eventType}`, paymentId: eventId });

    // Handle events
    switch (eventType) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        await prisma.order.updateMany({
          where: { razorpayOrderId: payment.order_id },
          data: { paymentStatus: 'PAID', status: 'CONFIRMED', razorpayPaymentId: payment.id, paymentCapturedAt: new Date() },
        });
        break;
      }
      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        await prisma.order.updateMany({
          where: { razorpayOrderId: payment.order_id },
          data: { paymentStatus: 'FAILED', status: 'FAILED' },
        });
        break;
      }
      case 'refund.created': {
        paymentLog('info', 'webhook', { message: 'Refund created', paymentId: eventId });
        break;
      }
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { processed: true, processedAt: new Date() },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    paymentLog('error', 'webhook', { error: err.message });
    // Return 200 even on error to prevent Razorpay retries
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
