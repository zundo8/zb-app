import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build filter for Payments
    const paymentsWhere: any = {};
    if (search) {
      paymentsWhere.OR = [
        { id: { contains: search } },
        { orderId: { contains: search } },
        { order: { shopifyOrderId: { contains: search, mode: 'insensitive' } } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Build filter for StoreCredits
    const storeCreditsWhere: any = {};
    if (search) {
      storeCreditsWhere.OR = [
        { id: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Build filter for Orders
    const ordersWhere: any = {};
    if (search) {
      ordersWhere.OR = [
        { id: { contains: search } },
        { shopifyOrderId: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Build filter for ReturnRequests
    const returnRequestsWhere: any = {
      status: "approved",
      actualRefund: { not: null },
    };
    if (search) {
      returnRequestsWhere.OR = [
        { id: { contains: search } },
        { reason: { contains: search, mode: 'insensitive' } },
        { order: { shopifyOrderId: { contains: search, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
        { order: { customer: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    // Fetch from all four tables (fetching enough to combine and paginate)
    const [payments, storeCredits, orders, returnRequests] = await Promise.all([
      prisma.payment.findMany({
        where: paymentsWhere,
        include: {
          customer: {
            select: { name: true, email: true }
          },
          order: {
            select: { shopifyOrderId: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit + offset + 100,
      }),
      prisma.storeCredit.findMany({
        where: storeCreditsWhere,
        include: {
          customer: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: limit + offset + 100,
      }),
      prisma.order.findMany({
        where: ordersWhere,
        include: {
          customer: {
            select: { name: true, email: true }
          },
          payments: true
        },
        orderBy: { createdAt: "desc" },
        take: limit + offset + 100,
      }),
      prisma.returnRequest.findMany({
        where: returnRequestsWhere,
        include: {
          order: {
            include: {
              customer: {
                select: { name: true, email: true }
              }
            }
          },
          returns: true
        },
        orderBy: { updatedAt: "desc" },
        take: limit + offset + 100,
      })
    ]);

    // Format Payments
    const formattedPayments = payments.map((p: any) => ({
      id: p.id,
      source: 'payment',
      type: p.type.toUpperCase(), // CAPTURE, REFUND, etc.
      amount: p.amount,
      status: p.status.toUpperCase(),
      gateway: p.gateway || 'razorpay',
      orderId: p.order?.shopifyOrderId || p.orderId,
      customerId: p.customerId,
      customerName: p.customer?.name || 'Unknown',
      customerEmail: p.customer?.email || '',
      description: p.type.toUpperCase() === 'REFUND' 
        ? `Refund for Order #${p.order?.shopifyOrderId || p.orderId || ''}` 
        : `Payment Capture for Order #${p.order?.shopifyOrderId || p.orderId || ''}`,
      date: p.createdAt,
    }));

    // Format StoreCredits
    const formattedStoreCredits = storeCredits.map((sc: any) => ({
      id: sc.id,
      source: 'store_credit',
      type: sc.type, // DEBIT, REFUND, MANUAL, etc.
      amount: sc.amount,
      status: 'COMPLETED',
      gateway: 'store_credit',
      orderId: sc.orderId || null,
      customerId: sc.customerId,
      customerName: sc.customer?.name || 'Unknown',
      customerEmail: sc.customer?.email || '',
      description: sc.description || 'Wallet balance adjustment',
      date: sc.createdAt,
    }));

    // Format Return Requests (refunds to original method)
    const formattedReturnRefunds = returnRequests
      // Only include return requests that were refunded to original method (not store credit)
      // to avoid duplication with store credit txns.
      .filter((rr: any) => rr.returns.some((r: any) => r.refundMethod === 'original_method'))
      .map((rr: any) => ({
        id: `ret_${rr.id}`,
        source: 'refund',
        type: 'REFUND',
        amount: rr.actualRefund || rr.estimatedRefund,
        status: 'SUCCESS',
        gateway: rr.returns.find((r: any) => r.refundMethod === 'original_method')?.refundMethod || 'gateway',
        orderId: rr.order.shopifyOrderId,
        customerId: rr.customerId,
        customerName: rr.order.customer?.name || 'Unknown',
        customerEmail: rr.order.customer?.email || '',
        description: rr.reason || `Refund for return of order #${rr.order.shopifyOrderId}`,
        date: rr.updatedAt,
      }));

    // Format Synced Orders (which do not have explicit Payment table logs)
    const existingOrderIds = new Set(payments.map((p: any) => p.orderId));
    const formattedOrders = orders
      .filter((o: any) => !existingOrderIds.has(o.id) && o.payments.length === 0)
      .map((o: any) => ({
        id: `ord_${o.id}`,
        source: 'payment',
        type: o.paymentStatus.toUpperCase() === 'REFUNDED' ? 'REFUND' : 'CAPTURE',
        amount: o.totalPrice,
        status: o.paymentStatus.toUpperCase() === 'PAID' ? 'SUCCESS' : o.paymentStatus.toUpperCase(),
        gateway: o.paymentMethod || 'gateway',
        orderId: o.shopifyOrderId,
        customerId: o.customerId,
        customerName: o.customer?.name || 'Guest',
        customerEmail: o.customer?.email || '',
        description: o.paymentStatus.toUpperCase() === 'REFUNDED'
          ? `Refund for Order #${o.shopifyOrderId}`
          : `Payment for Order #${o.shopifyOrderId}`,
        date: o.createdAt,
      }));

    // Combine and sort by date descending
    let allTransactions = [
      ...formattedPayments, 
      ...formattedStoreCredits, 
      ...formattedReturnRefunds,
      ...formattedOrders
    ];
    allTransactions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply pagination offset & limit
    const total = allTransactions.length;
    const paginated = allTransactions.slice(offset, offset + limit);

    return NextResponse.json({
      transactions: paginated,
      total
    });
  } catch (error: any) {
    console.error("Transaction History GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
