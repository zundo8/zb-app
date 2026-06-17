import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import Razorpay from 'razorpay';
import prisma from '@/lib/db';

/**
 * Automatically processes a refund via Razorpay for cancelled orders.
 * Handles prepaid orders (full refund) and COD orders (refunds the Rs. 99 upfront fee).
 * Prevents duplicate refunds by checking database records.
 * Supports mock payment IDs for local testing.
 */
export async function processOrderRefund(orderId: string) {
  console.log(`[AutoRefund] Starting auto-refund check for Order: ${orderId}`);
  
  try {
    // 1. Fetch the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true }
    });
    
    if (!order) {
      console.error(`[AutoRefund] Order not found: ${orderId}`);
      return { success: false, error: 'Order not found' };
    }

    // 2. Only refund if order is cancelled
    if (order.status.toLowerCase() !== 'cancelled') {
      console.log(`[AutoRefund] Order ${orderId} is not in cancelled status (current status: ${order.status}). Skipping.`);
      return { success: false, error: 'Order is not cancelled' };
    }

    // 3. Check if already refunded in DB
    const alreadyRefunded = order.payments.some(p => p.type.toLowerCase() === 'refund' && p.status.toLowerCase() === 'completed');
    if (alreadyRefunded) {
      console.log(`[AutoRefund] Order ${orderId} already has a completed refund record. Skipping.`);
      return { success: true, message: 'Already refunded' };
    }

    // 4. Determine payment ID to refund
    const paymentId = order.razorpayPaymentId;
    if (!paymentId) {
      console.log(`[AutoRefund] Order ${orderId} has no razorpayPaymentId. No online payment to refund.`);
      return { success: true, message: 'No payment ID to refund' };
    }

    // 5. Determine refund amount
    let refundAmount = 0;
    const isCod = order.paymentMethod?.toUpperCase() === 'COD';
    
    // Find linked WebStoreOrder to get exact values if available
    let webStoreOrder = null;
    if (order.razorpayOrderId) {
      webStoreOrder = await prisma.webStoreOrder.findFirst({
        where: { razorpayOrderId: order.razorpayOrderId }
      });
    }
    if (!webStoreOrder) {
      webStoreOrder = await prisma.webStoreOrder.findFirst({
        where: { notes: { contains: `Local: ${order.id}` } }
      });
    }

    if (isCod) {
      // For COD, refund the upfront fee (typically Rs 99)
      refundAmount = webStoreOrder ? Number(webStoreOrder.codUpfrontPaid) : 99;
    } else {
      // For Prepaid, refund the total price
      refundAmount = order.totalPrice;
    }

    if (refundAmount <= 0) {
      console.log(`[AutoRefund] Refund amount is 0 or negative: ${refundAmount}. Skipping.`);
      return { success: true, message: 'Refund amount is zero' };
    }

    console.log(`[AutoRefund] Processing refund of ₹${refundAmount} for payment ${paymentId} (Order: ${orderId}, Method: ${order.paymentMethod})`);

    // Support mock orders/payments in test mode
    const isMock = paymentId.startsWith('pay_mock_') || (order.razorpayOrderId && order.razorpayOrderId.startsWith('order_mock_'));
    
    if (isMock) {
      console.warn(`[AutoRefund] Processing MOCK refund for mock payment ${paymentId}`);
      
      // Create local payment refund record
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            amount: refundAmount,
            type: 'refund',
            status: 'completed',
            gateway: 'razorpay'
          }
        }),
        prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'refunded',
            note: order.note ? `${order.note}\n[Refund] Mock refund of ₹${refundAmount} processed.` : `[Refund] Mock refund of ₹${refundAmount} processed.`
          }
        })
      ]);

      if (webStoreOrder) {
        await prisma.webStoreOrder.update({
          where: { id: webStoreOrder.id },
          data: {
            paymentStatus: 'refunded',
            notes: webStoreOrder.notes ? `${webStoreOrder.notes}\n[Refund] Mock refund of ₹${refundAmount} processed.` : `[Refund] Mock refund of ₹${refundAmount} processed.`
          }
        });
      }

      return { success: true, message: 'Mock refund processed successfully' };
    }

    // 6. Execute Razorpay Refund
    const creds = await resolveRazorpayCredentials();
    const razorpayInstance = new Razorpay({ key_id: creds.key_id, key_secret: creds.key_secret });
    
    // Razorpay amounts are in paise (cents), so multiply by 100
    const amountInPaise = Math.round(refundAmount * 100);

    const refund = await razorpayInstance.payments.refund(paymentId, {
      amount: amountInPaise,
      notes: {
        orderId: order.id,
        shopifyOrderId: order.shopifyOrderId || '',
        reason: 'Order cancelled before fulfillment'
      }
    });

    console.log(`[AutoRefund] Razorpay refund successful! Refund ID: ${refund.id}`);

    // 7. Update Database
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          amount: refundAmount,
          type: 'refund',
          status: 'completed',
          gateway: 'razorpay'
        }
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'refunded',
          note: order.note ? `${order.note}\n[Refund] Auto-refund of ₹${refundAmount} processed via Razorpay (Refund ID: ${refund.id}).` : `[Refund] Auto-refund of ₹${refundAmount} processed via Razorpay (Refund ID: ${refund.id}).`
        }
      })
    ]);

    if (webStoreOrder) {
      await prisma.webStoreOrder.update({
        where: { id: webStoreOrder.id },
        data: {
          paymentStatus: 'refunded',
          notes: webStoreOrder.notes ? `${webStoreOrder.notes}\n[Refund] Auto-refund of ₹${refundAmount} processed (Refund ID: ${refund.id}).` : `[Refund] Auto-refund of ₹${refundAmount} processed (Refund ID: ${refund.id}).`
        }
      });
    }

    return { success: true, refundId: refund.id };
  } catch (err: any) {
    console.error(`[AutoRefund] Razorpay refund API failed for Order ${orderId}:`, err);
    const errorMessage = err?.error?.description || err?.message || 'Unknown error';
    
    try {
      const currentOrder = await prisma.order.findUnique({
        where: { id: orderId },
        select: { note: true }
      });
      await prisma.order.update({
        where: { id: orderId },
        data: {
          note: currentOrder?.note 
            ? `${currentOrder.note}\n[Refund Failed] Tried auto-refund but it failed: ${errorMessage}` 
            : `[Refund Failed] Tried auto-refund but it failed: ${errorMessage}`
        }
      });
    } catch (dbErr) {
      console.error(`[AutoRefund] Failed to update order note with failure message:`, dbErr);
    }
    
    return { success: false, error: errorMessage };
  }
}
