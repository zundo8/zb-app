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

    // Fetch from both tables (fetching enough to combine and paginate)
    const [payments, storeCredits] = await Promise.all([
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
      })
    ]);

    // Format Payments
    const formattedPayments = payments.map(p => ({
      id: p.id,
      source: 'payment',
      type: p.type.toUpperCase(), // CAPTURE, REFUND, INITIAL, etc.
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
    const formattedStoreCredits = storeCredits.map(sc => ({
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

    // Combine and sort by date descending
    let allTransactions = [...formattedPayments, ...formattedStoreCredits];
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
