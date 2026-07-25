import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchAllOrders } from '@/lib/shopify-admin';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';

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
    const platform = searchParams.get('platform');
    const search = searchParams.get('search');
    const sync = searchParams.get('sync') === 'true';

    // Removed automatic live sync on every request to avoid "heavy load" and timeout issues.
    // Syncing is now handled manually via the 'Sync Shopify' button in the dashboard.

    const conditions: any[] = [];
    
    // ─── STRICT ORDER SEPARATION ───
    // The main Orders page should ONLY show orders where payment has actually completed (or approved COD).
    // It must EXCLUDE:
    // 1. WebStore orders that are pending payment, payment failed, or cancelled
    // 2. Mobile orders that are still in pending/awaiting_approval status
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
          { internalOrderNumber: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { tags: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};
    console.log('[Admin Orders] Final WHERE clause:', JSON.stringify(where));

    const orders = await prisma.order.findMany({
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
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.order.count({ where });

    const enrichedOrders = await Promise.all(
      orders.map(async (order: any) => {
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
        if (!webStoreOrder && order.shopifyOrderId) {
          webStoreOrder = await prisma.webStoreOrder.findFirst({
            where: { notes: { contains: `Shopify: ${order.shopifyOrderId}` } }
          });
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

        return {
          ...order,
          totalPrice,
          codUpfrontPaid,
          paymentMethod,
          paymentStatus,
          paidAmount
        };
      })
    );

    let finalOrders = enrichedOrders;
    let finalTotal = total;

    if (finalOrders.length === 0) {
      try {
        const shopifyOrders = await fetchAllOrders(limit || 50);
        finalOrders = shopifyOrders.map((so: any) => ({
          id: String(so.id),
          shopifyOrderId: String(so.id),
          internalOrderNumber: so.name || `#${so.order_number}`,
          orderType: 'WEB_STORE',
          status: so.fulfillment_status || 'open',
          paymentStatus: so.financial_status === 'paid' ? 'paid' : (so.financial_status || 'pending'),
          fulfillmentStatus: so.fulfillment_status || 'unfulfilled',
          totalPrice: parseFloat(so.total_price || '0'),
          subtotalPrice: parseFloat(so.subtotal_price || '0'),
          discountAmount: parseFloat(so.total_discounts || '0'),
          paidAmount: so.financial_status === 'paid' ? parseFloat(so.total_price || '0') : 0,
          currency: so.currency || 'INR',
          createdAt: so.created_at,
          updatedAt: so.updated_at,
          customer: so.customer ? {
            id: String(so.customer.id),
            name: `${so.customer.first_name || ''} ${so.customer.last_name || ''}`.trim() || 'Customer',
            email: so.customer.email,
            phone: so.customer.phone || so.phone,
          } : null,
          items: (so.line_items || []).map((li: any) => ({
            id: String(li.id),
            title: li.title,
            quantity: li.quantity,
            price: parseFloat(li.price || '0'),
            sku: li.sku,
            variantTitle: li.variant_title
          }))
        }));
        finalTotal = finalOrders.length;
      } catch (shopifyErr: any) {
        console.warn('[Admin Orders API] Shopify orders fallback error:', shopifyErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      orders: finalOrders,
      total: finalTotal,
      hasMore: finalTotal > offset + limit
    });
  } catch (error: any) {
    try {
      const shopifyOrders = await fetchAllOrders(50);
      const finalOrders = shopifyOrders.map((so: any) => ({
        id: String(so.id),
        shopifyOrderId: String(so.id),
        internalOrderNumber: so.name || `#${so.order_number}`,
        orderType: 'WEB_STORE',
        status: so.fulfillment_status || 'open',
        paymentStatus: so.financial_status === 'paid' ? 'paid' : (so.financial_status || 'pending'),
        fulfillmentStatus: so.fulfillment_status || 'unfulfilled',
        totalPrice: parseFloat(so.total_price || '0'),
        currency: so.currency || 'INR',
        createdAt: so.created_at,
        customer: so.customer ? {
          id: String(so.customer.id),
          name: `${so.customer.first_name || ''} ${so.customer.last_name || ''}`.trim() || 'Customer',
          email: so.customer.email,
          phone: so.customer.phone || so.phone,
        } : null,
        items: (so.line_items || []).map((li: any) => ({
          id: String(li.id),
          title: li.title,
          quantity: li.quantity,
          price: parseFloat(li.price || '0')
        }))
      }));
      return NextResponse.json({
        success: true,
        orders: finalOrders,
        total: finalOrders.length,
        hasMore: false
      });
    } catch (e2) {
      return handleAuthError(error);
    }
  }
}
