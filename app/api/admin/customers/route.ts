import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchAllCustomers } from '@/lib/shopify-admin';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requirePermission('CUSTOMERS', 'view');
    const url = new URL(req.url);
    const format = url.searchParams.get('format');
    // Performance Optimization: Check for count-only mode
    const countOnly = url.searchParams.get('count') === 'true';
    if (countOnly) {
      const total = await prisma.customer.count();
      return NextResponse.json({ success: true, total }, { status: 200 });
    }

    const search = url.searchParams.get('search')?.trim().toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));
    const offset = (page - 1) * limit;

    const customerWhere: any = {};
    if (search) {
      customerWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { shopifyId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch DB customers with pagination
    const [dbCustomers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where: customerWhere,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              items: true,
            },
          },
        },
      }),
      prisma.customer.count({ where: customerWhere }),
    ]);

    // Fire-and-forget background sync (non-blocking) on page 1 without active search
    if (page === 1 && !search) {
      (async () => {
        try {
          const shop = await prisma.shop.findFirst();
          if (shop) {
            const shopifyCustomers = await fetchAllCustomers(100).catch(() => []);
            for (const sc of shopifyCustomers) {
              const shopifyId = String(sc.id);
              const email = sc.email || null;
              const phone = sc.phone || null;
              const name = `${sc.first_name || ""} ${sc.last_name || ""}`.trim() || email || phone || "Customer";

              await prisma.customer.upsert({
                where: { shopifyId },
                update: {
                  email,
                  phone,
                  name,
                  ordersCount: sc.orders_count || 0,
                  totalSpent: parseFloat(sc.total_spent || "0"),
                },
                create: {
                  shopifyId,
                  shopId: shop.id,
                  email,
                  phone,
                  name,
                  ordersCount: sc.orders_count || 0,
                  totalSpent: parseFloat(sc.total_spent || "0"),
                }
              }).catch(() => {});
            }
          }
        } catch (e: any) {
          console.error("[Customers Sync BG] Error:", e.message);
        }
      })();
    }

    let payload = dbCustomers.map((c) => {
      const displayName = c.name || c.email || (c.shopifyId !== 'anonymous' ? c.shopifyId : 'Anonymous User');
      const totalOrders = c.ordersCount || c.orders.length;
      const totalSpent = c.totalSpent || c.orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      return {
        id: c.id,
        shopifyId: c.shopifyId,
        email: c.email,
        name: displayName,
        phone: c.phone,
        createdAt: c.createdAt,
        lastLoginAt: c.lastLoginAt,
        totalOrders,
        totalSpent: isNaN(totalSpent) ? 0 : totalSpent,
        tags: '',
        orders: c.orders.map((o) => ({
          id: o.id,
          shopifyOrderId: o.shopifyOrderId,
          status: o.status,
          totalPrice: o.totalPrice || 0,
          paymentStatus: o.paymentStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          createdAt: o.createdAt,
          items: o.items.map((i) => ({
            id: i.id,
            title: i.title,
            quantity: i.quantity,
            price: i.price,
            sku: i.sku,
          })),
        })),
      };
    });

    if (format === 'csv') {
      // CSV logic placeholder
    }

    return NextResponse.json({
      success: true,
      customers: payload,
      total: totalCount,
      page,
      limit,
      hasMore: offset + payload.length < totalCount,
    }, { status: 200 });
  } catch (error) {
    return handleAuthError(error);
  }
}
