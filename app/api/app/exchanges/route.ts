import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/app/exchanges?customerId=...
 * GET /api/app/exchanges?phone=...
 * GET /api/app/exchanges?email=...
 *
 * List all exchange requests for a customer.
 * Used by the React Native app to show exchange status in Order Detail / Profile.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId')?.trim();
    const phone = url.searchParams.get('phone')?.trim();
    const email = url.searchParams.get('email')?.trim();

    if (!customerId && !phone && !email) {
      return NextResponse.json(
        { exchanges: [], error: 'customerId, phone or email query parameter required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Resolve customer IDs from the order → customer relationship
    const customerWhere: any = { OR: [] };
    if (customerId) customerWhere.OR.push({ id: customerId });
    if (phone) customerWhere.OR.push({ phone });
    if (email) customerWhere.OR.push({ email });

    const customers = await prisma.customer.findMany({
      where: customerWhere,
      select: { id: true },
    });

    if (customers.length === 0) {
      return NextResponse.json({ exchanges: [] }, { headers: corsHeaders });
    }

    const customerIds = customers.map((c: { id: string }) => c.id);

    // Find all orders for these customers, then get exchanges from those orders
    const orders = await prisma.order.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });

    const orderIds = orders.map((o: { id: string }) => o.id);

    if (orderIds.length === 0) {
      return NextResponse.json({ exchanges: [] }, { headers: corsHeaders });
    }

    const exchanges = await prisma.exchange.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, shopifyOrderId: true } },
        originalProduct: { select: { id: true, title: true, shopifyProductId: true, featuredImage: true } },
        newProduct: { select: { id: true, title: true, shopifyProductId: true, featuredImage: true } },
      },
    });

    const formatted = exchanges.map((e: any) => ({
      id: e.id,
      orderId: e.orderId,
      orderNumber: e.order?.shopifyOrderId || null,
      originalProduct: {
        id: e.originalProduct?.id || null,
        title: e.originalProduct?.title || 'Unknown',
        shopifyProductId: e.originalProduct?.shopifyProductId || null,
        image: e.originalProduct?.featuredImage || null,
      },
      newProduct: {
        id: e.newProduct?.id || null,
        title: e.newProduct?.title || 'Unknown',
        shopifyProductId: e.newProduct?.shopifyProductId || null,
        image: e.newProduct?.featuredImage || null,
      },
      status: e.status,
      priceDifference: e.priceDifference,
      paymentStatus: e.paymentStatus,
      newOrderId: e.newOrderId,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return NextResponse.json({ exchanges: formatted }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[App API] Exchanges list error:', error.message);
    return NextResponse.json(
      { exchanges: [], error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
