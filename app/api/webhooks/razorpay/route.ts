import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // 1. Log the event raw for debugging and audit
  const eventData = JSON.parse(payload);
  const eventType = eventData.event;

  const webhookRecord = await prisma.webhookEvent.create({
    data: {
      source: 'razorpay',
      eventType,
      payload,
    },
  });

  // 2. Verify signature if secret is configured
  if (secret && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('[Razorpay Webhook] Signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  try {
    // 3. Handle specific events
    const data = eventData.payload;

    if (eventType === 'payment.captured' || eventType === 'order.paid' || eventType === 'payment.authorized') {
      const payment = data.payment.entity;
      const razorpayOrderId = payment.order_id || payment.notes?.order_id || payment.notes?.razorpay_order_id;
      const razorpayPaymentId = payment.id;

      if (!razorpayOrderId) {
        console.warn('[Razorpay Webhook] Received payment without order_id in payload or notes:', razorpayPaymentId);
        return NextResponse.json({ success: true, message: 'No order ID found' });
      }

      // Update order status in DB
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId },
      });

      if (order) {
        // If it's already paid, skip
        if (order.paymentStatus === 'paid') {
           return NextResponse.json({ success: true });
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'paid',
            razorpayPaymentId,
            paymentCapturedAt: new Date(),
            status: (order.status === 'PENDING' || order.status === 'awaiting_approval') ? 'OPEN' : order.status,
          },
        });

        // Add payment record
        await prisma.payment.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            amount: payment.amount / 100,
            type: 'CAPTURE',
            status: 'success',
            gateway: 'razorpay',
          },
        });

        console.log(`[Razorpay Webhook] Order ${order.shopifyOrderId || order.id} marked as PAID`);
      }
    }
 else if (eventType === 'payment.failed') {
      const payment = data.payment.entity;
      const razorpayOrderId = payment.order_id;

      await prisma.order.updateMany({
        where: { razorpayOrderId },
        data: { paymentStatus: 'failed', status: 'FAILED' },
      });
    } else if (eventType === 'refund.processed' || eventType === 'refund.created' || eventType === 'refund.failed') {
      const refund = data.refund.entity;
      const paymentId = refund.payment_id;
      const refundStatus = eventType === 'refund.processed' ? 'processed' : 
                          eventType === 'refund.failed' ? 'failed' : 'pending';

      // Find the order by payment ID
      const order = await prisma.order.findUnique({
        where: { razorpayPaymentId: paymentId },
        include: { returns: true }
      });

      if (order) {
        // Update order payment status
        await prisma.order.update({
          where: { id: order.id },
          data: { 
            paymentStatus: eventType === 'refund.processed' ? 'refunded' : 
                           eventType === 'refund.failed' ? 'paid' : 'partial_refund' 
          },
        });

        // Update associated returns
        if (order.returns.length > 0) {
          await prisma.return.updateMany({
            where: { 
              orderId: order.id,
              status: { in: ['APPROVED', 'COMPLETED'] } // Only update relevant returns
            },
            data: { 
              refundStatus: refundStatus.toUpperCase()
            },
          });
        }

        console.log(`[Razorpay Webhook] Refund ${refund.id} for Order ${order.shopifyOrderId} is ${refundStatus}`);
      }
    }

    // Mark event as processed
    await prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { processed: true, processedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Razorpay Webhook] Processing error:', error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
