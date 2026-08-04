import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';
import { enrichItemsWithSize } from '@/lib/enrichSize';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requirePermission('ORDERS', 'view');
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const fulfillmentStatus = searchParams.get('fulfillmentStatus');
    const search = searchParams.get('search');

    const conditions: any[] = [];
    
    // ─── STRICT ORDER SEPARATION ───
    conditions.push({
      NOT: {
        OR: [
          { status: 'payment_pending' },
          { status: 'payment_failed' },
          { status: 'FAILED' },
          { status: 'cancelled' },
          { paymentStatus: 'payment_pending' },
          { paymentStatus: 'failed' },
          { paymentStatus: 'cancelled' },
          {
            AND: [
              { paymentStatus: 'pending' },
              { NOT: { status: { in: ['approved', 'open', 'fulfilled', 'delivered', 'shipped'] } } }
            ]
          },
          {
            AND: [
              { orderType: 'MOBILE_APP' },
              { 
                OR: [
                  { shopifyOrderId: { startsWith: 'ZB' } },
                  { shopifyOrderId: { startsWith: '#ZB' } },
                  { shopifyOrderId: { contains: '#' } },
                  { status: 'awaiting_approval' }
                ]
              }
            ]
          }
        ]
      }
    });

    if (status && status !== 'any') {
      conditions.push({ status });
    }

    if (paymentStatus && paymentStatus !== 'any') {
      if (paymentStatus === 'failed') {
        conditions.push({ 
          OR: [
            { paymentStatus: 'failed' },
            { paymentStatus: 'voided' },
            { status: 'payment_failed' }
          ]
        });
      } else {
        conditions.push({ paymentStatus });
      }
    }

    if (fulfillmentStatus && fulfillmentStatus !== 'any') {
      conditions.push({ fulfillmentStatus });
    }

    if (search) {
      conditions.push({
        OR: [
          { shopifyOrderId: { contains: search, mode: 'insensitive' } },
          { shopifyOrderName: { contains: search, mode: 'insensitive' } },
          { internalOrderNumber: { contains: search, mode: 'insensitive' } },
          { previousOrderNumbers: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { tags: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          items: true,
          shipments: {
            where: { type: 'outbound' },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.order.count({ where })
    ]);

    // ─── BATCHED WEB STORE ORDER LOOKUP (ELIMINATES N+1 DB QUERIES) ───
    const razorpayIds = orders.map((o: any) => o.razorpayOrderId).filter(Boolean);
    const localIdNotes = orders.map((o: any) => `Local: ${o.id}`);
    const shopifyIdNotes = orders.map((o: any) => o.shopifyOrderId ? `Shopify: ${o.shopifyOrderId}` : null).filter(Boolean) as string[];

    const orClauses: any[] = [];
    if (razorpayIds.length > 0) {
      orClauses.push({ razorpayOrderId: { in: razorpayIds } });
    }
    localIdNotes.forEach((noteStr: string) => {
      orClauses.push({ notes: { contains: noteStr } });
    });
    shopifyIdNotes.forEach((noteStr: string) => {
      orClauses.push({ notes: { contains: noteStr } });
    });

    const webStoreOrders = orClauses.length > 0
      ? await prisma.webStoreOrder.findMany({ where: { OR: orClauses } })
      : [];

    const byRazorpayId = new Map<string, any>();
    const byNotes = new Map<string, any>();

    webStoreOrders.forEach((wso: any) => {
      if (wso.razorpayOrderId) byRazorpayId.set(wso.razorpayOrderId, wso);
      if (wso.notes) byNotes.set(wso.notes, wso);
    });

    const enrichedOrders = orders.map((order: any) => {
      let webStoreOrder = null;
      if (order.razorpayOrderId) {
        webStoreOrder = byRazorpayId.get(order.razorpayOrderId);
      }
      if (!webStoreOrder) {
        for (const [notes, wso] of byNotes.entries()) {
          if (notes.includes(`Local: ${order.id}`)) {
            webStoreOrder = wso;
            break;
          }
        }
      }
      if (!webStoreOrder && order.shopifyOrderId) {
        for (const [notes, wso] of byNotes.entries()) {
          if (notes.includes(`Shopify: ${order.shopifyOrderId}`)) {
            webStoreOrder = wso;
            break;
          }
        }
      }

      const codUpfrontPaid = webStoreOrder?.codUpfrontPaid ? Number(webStoreOrder.codUpfrontPaid) : 0;
      const paymentMethod = webStoreOrder?.paymentMethod || order.paymentMethod;
      const paymentStatus = webStoreOrder?.paymentStatus || order.paymentStatus;
      const discountAmount = webStoreOrder?.discountAmount 
        ? Number(webStoreOrder.discountAmount) 
        : (order.discountAmount || 0);

      let totalPrice = order.totalPrice;
      const subtotalPrice = order.subtotalPrice || totalPrice;
      if (discountAmount > 0 && Math.abs(totalPrice - subtotalPrice) < 0.01) {
        totalPrice = subtotalPrice - discountAmount;
      }
      
      let paidAmount = 0;
      if (paymentMethod === 'COD' || paymentMethod === 'cod') {
        paidAmount = codUpfrontPaid;
      } else if (paymentStatus === 'paid' || paymentStatus === 'success') {
        paidAmount = totalPrice;
      }

      const displayOrderNumber = order.internalOrderNumber || order.shopifyOrderName || (order.shopifyOrderId && !order.shopifyOrderId.startsWith('app_') ? `#${order.shopifyOrderId.replace('#', '')}` : null) || `#${order.id.slice(-6).toUpperCase()}`;

      return {
        ...order,
        displayOrderNumber,
        totalPrice,
        codUpfrontPaid,
        paymentMethod,
        paymentStatus,
        paidAmount
      };
    });

    const fullyEnrichedOrders = await Promise.all(
      enrichedOrders.map(async (order: any) => ({
        ...order,
        items: await enrichItemsWithSize(order.items || [], order)
      }))
    );

    return NextResponse.json({
      success: true,
      orders: fullyEnrichedOrders,
      total,
      hasMore: total > offset + limit
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
