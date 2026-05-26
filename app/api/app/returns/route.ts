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
 * GET /api/app/returns?customerId=...
 * GET /api/app/returns?phone=...
 * GET /api/app/returns?email=...
 *
 * List all return requests for a customer.
 * Used by the React Native app to show return status in Order Detail / Profile.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId')?.trim();
    const phone = url.searchParams.get('phone')?.trim();
    const email = url.searchParams.get('email')?.trim();

    if (!customerId && !phone && !email) {
      return NextResponse.json(
        { returns: [], error: 'customerId, phone or email query parameter required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Resolve customer IDs
    const customerWhere: any = { OR: [] };
    if (customerId) customerWhere.OR.push({ id: customerId });
    if (phone) customerWhere.OR.push({ phone });
    if (email) customerWhere.OR.push({ email });

    const customers = await prisma.customer.findMany({
      where: customerWhere,
      select: { id: true },
    });

    if (customers.length === 0) {
      return NextResponse.json({ returns: [] }, { headers: corsHeaders });
    }

    const customerIds = customers.map((c: { id: string }) => c.id);

    const returns = await prisma.return.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { requestedAt: 'desc' },
      include: {
        order: { select: { id: true, shopifyOrderId: true, totalPrice: true } },
        product: { select: { id: true, title: true, shopifyProductId: true, featuredImage: true } },
      },
    });

    const formatted = returns.map((r: any) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.shopifyOrderId || null,
      product: {
        id: r.product?.id || null,
        title: r.product?.title || 'Unknown Product',
        shopifyProductId: r.product?.shopifyProductId || null,
        image: r.product?.featuredImage || null,
      },
      sku: r.sku,
      reason: r.reason,
      status: r.status,
      returnMethod: r.returnMethod,
      trackingNumber: r.trackingNumber,
      refundAmount: r.refundAmount,
      refundStatus: r.refundStatus,
      requestedAt: r.requestedAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({ returns: formatted }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[App API] Returns list error:', error.message);
    return NextResponse.json(
      { returns: [], error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
