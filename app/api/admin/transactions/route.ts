import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import prisma from '@/lib/db';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const filterStatus = searchParams.get('status'); // 'all', 'orphaned', 'mismatched', 'matched'
    
    // Default to last 30 days if no dates provided
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    
    const from = fromStr ? Math.floor(new Date(fromStr).getTime() / 1000) : thirtyDaysAgo;
    const to = toStr ? Math.floor(new Date(toStr).getTime() / 1000) : now;

    // Resolve Razorpay SDK instance
    const { key_id, key_secret } = await resolveRazorpayCredentials();
    const razorpay = new Razorpay({ key_id, key_secret });

    // Fetch payments from Razorpay API
    const skip = (page - 1) * limit;
    const rzpPaymentsResponse: any = await razorpay.payments.all({
      from,
      to,
      count: limit,
      skip,
    });

    const rzpPayments = rzpPaymentsResponse.items || [];
    const totalCount = rzpPaymentsResponse.count || rzpPayments.length;

    if (rzpPayments.length === 0) {
      return NextResponse.json({
        payments: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        summary: { totalCaptured: 0, matchedCount: 0, orphanedCount: 0, mismatchedCount: 0 },
      });
    }

    // Collect payment IDs and order IDs for batch cross-referencing
    const paymentIds = rzpPayments.map((p: any) => p.id);
    const razorpayOrderIds = rzpPayments.map((p: any) => p.order_id).filter(Boolean);

    // Query local DB Orders
    const localOrders = await prisma.order.findMany({
      where: {
        OR: [
          { razorpayPaymentId: { in: paymentIds } },
          { razorpayOrderId: { in: razorpayOrderIds } },
        ],
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // Query local DB Payments
    const localPayments = await prisma.payment.findMany({
      where: {
        gateway: 'razorpay',
        orderId: { in: localOrders.map((o: any) => o.id) },
      },
    });

    // Create lookup maps
    const orderMapByPaymentId = new Map<string, typeof localOrders[0]>();
    const orderMapByOrderId = new Map<string, typeof localOrders[0]>();

    for (const order of localOrders) {
      if (order.razorpayPaymentId) {
        orderMapByPaymentId.set(order.razorpayPaymentId, order);
      }
      if (order.razorpayOrderId) {
        orderMapByOrderId.set(order.razorpayOrderId, order);
      }
    }

    let totalCapturedAmount = 0;
    let matchedCount = 0;
    let orphanedCount = 0;
    let mismatchedCount = 0;

    // Process and classify each Razorpay payment
    const transactions = rzpPayments.map((rzpPayment: any) => {
      const paymentId = rzpPayment.id;
      const razorpayOrderId = rzpPayment.order_id || rzpPayment.notes?.order_id || rzpPayment.notes?.razorpay_order_id || null;
      const amount = (rzpPayment.amount || 0) / 100; // paise to rupees
      const method = rzpPayment.method || 'unknown';
      const capturedAt = rzpPayment.created_at ? new Date(rzpPayment.created_at * 1000).toISOString() : new Date().toISOString();
      const rzpStatus = rzpPayment.status;

      if (rzpStatus === 'captured') {
        totalCapturedAmount += amount;
      }

      // Check cross-reference
      const localOrder = orderMapByPaymentId.get(paymentId) || (razorpayOrderId ? orderMapByOrderId.get(razorpayOrderId) : undefined);

      let classification: 'Matched' | 'Orphaned' | 'Mismatched' = 'Orphaned';
      let mismatchReason: string | null = null;

      if (!localOrder) {
        if (rzpStatus === 'captured' || rzpStatus === 'authorized') {
          classification = 'Orphaned';
          orphanedCount++;
        } else {
          classification = 'Matched'; // failed/refunded payments with no order are expected
        }
      } else {
        // Order exists
        const isStatusPaid = localOrder.paymentStatus?.toLowerCase() === 'paid';
        const isAmountMatch = Math.abs(localOrder.totalPrice - amount) < 1.0; // within ₹1

        if (isStatusPaid && isAmountMatch) {
          classification = 'Matched';
          matchedCount++;
        } else {
          classification = 'Mismatched';
          mismatchedCount++;
          if (!isStatusPaid && !isAmountMatch) {
            mismatchReason = `Payment status is '${localOrder.paymentStatus}' and order total (₹${localOrder.totalPrice}) differs from captured (₹${amount})`;
          } else if (!isStatusPaid) {
            mismatchReason = `Local order paymentStatus is '${localOrder.paymentStatus}' (expected 'paid')`;
          } else {
            mismatchReason = `Amount mismatch: local order total is ₹${localOrder.totalPrice}, Razorpay captured ₹${amount}`;
          }
        }
      }

      // Extract customer details
      const customerName = localOrder?.customer?.name || rzpPayment.notes?.name || rzpPayment.email?.split('@')[0] || 'Unknown Customer';
      const customerEmail = localOrder?.customer?.email || rzpPayment.email || rzpPayment.notes?.email || 'N/A';
      const customerPhone = localOrder?.customer?.phone || rzpPayment.contact || rzpPayment.notes?.contact || 'N/A';

      return {
        paymentId,
        razorpayOrderId,
        amount,
        currency: rzpPayment.currency || 'INR',
        method,
        status: rzpStatus, // Razorpay status: 'captured', 'failed', 'refunded', etc.
        capturedAt,
        classification, // 'Matched' | 'Orphaned' | 'Mismatched'
        mismatchReason,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        localOrder: localOrder
          ? {
              id: localOrder.id,
              internalOrderNumber: localOrder.internalOrderNumber,
              shopifyOrderId: localOrder.shopifyOrderId,
              totalPrice: localOrder.totalPrice,
              paymentStatus: localOrder.paymentStatus,
              orderStatus: localOrder.status,
              createdAt: localOrder.createdAt,
            }
          : null,
        notes: rzpPayment.notes || {},
        card: rzpPayment.card ? {
          network: rzpPayment.card.network,
          last4: rzpPayment.card.last4,
          type: rzpPayment.card.type,
        } : null,
        vpa: rzpPayment.vpa || null, // UPI VPA if available
      };
    });

    // Filter by classification if status query parameter is provided
    let filteredTransactions = transactions;
    if (filterStatus && filterStatus !== 'all') {
      filteredTransactions = transactions.filter((t: any) => t.classification.toLowerCase() === filterStatus.toLowerCase());
    }

    return NextResponse.json({
      payments: filteredTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalCaptured: totalCapturedAmount,
        matchedCount,
        orphanedCount,
        mismatchedCount,
      },
    });
  } catch (error: any) {
    console.error('[Admin Transactions API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Razorpay transactions' },
      { status: 500 }
    );
  }
}
