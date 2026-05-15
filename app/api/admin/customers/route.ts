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
    const search = url.searchParams.get('search')?.trim().toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));
    const offset = (page - 1) * limit;

    // Fetch DB customers and Shopify customers in parallel
    // Wrap Shopify call so a failure doesn't crash the entire request
    const [dbCustomers, shopifyCustomers] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            include: {
              items: true,
            },
          },
        },
      }),
      fetchAllCustomers(250).catch((err: any) => {
        console.error('[Admin Customers] Shopify fetch failed:', err.message);
        return [];
      }),
    ]);

    const shopifyMap = new Map<
      string,
      {
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        tags: string;
      }
    >();

    for (const c of shopifyCustomers) {
      shopifyMap.set(String(c.id), {
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        tags: c.tags,
      });
    }

    let payload = dbCustomers.map((c) => {
      const s = shopifyMap.get(c.shopifyId);

      const shopifyName = s
        ? `${s.first_name || ''} ${s.last_name || ''}`.trim()
        : '';
      const email = s?.email || c.email || null;
      const phone = s?.phone || c.phone || null;

      const displayName =
        shopifyName ||
        c.name ||
        email ||
        (c.shopifyId !== 'anonymous' ? c.shopifyId : 'Anonymous User');

      const totalOrders = c.orders.length;
      const totalSpent = c.orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      return {
        id: c.id,
        shopifyId: c.shopifyId,
        email,
        name: displayName,
        phone,
        createdAt: c.createdAt,
        lastLoginAt: c.lastLoginAt,
        totalOrders,
        totalSpent: isNaN(totalSpent) ? 0 : totalSpent,
        tags: s?.tags || '',
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

    // Search filter
    if (search) {
      payload = payload.filter((c) => {
        const searchable = [
          c.name,
          c.email,
          c.phone,
          c.shopifyId,
          c.tags,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(search);
      });
    }

    const total = payload.length;

    if (format === 'csv') {
      const header = [
        'Shopify ID',
        'Name',
        'Email',
        'Phone',
        'Created At',
        'Total Orders',
        'Total Spent',
        'Tags',
      ];

      const rows = payload.map((c) => [
        c.shopifyId,
        c.name || '',
        c.email || '',
        c.phone || '',
        new Date(c.createdAt).toISOString(),
        String(c.totalOrders),
        (c.totalSpent || 0).toFixed(2),
        c.tags,
      ]);

      const csv = [header, ...rows]
        .map((cols) =>
          cols
            .map((v) => {
              const s = String(v ?? '');
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(','),
        )
        .join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="customers.csv"',
        },
      });
    }

    // Paginate
    const paginated = payload.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      customers: paginated,
      total,
      page,
      limit,
      hasMore: offset + paginated.length < total,
    }, { status: 200 });
  } catch (error) {
    return handleAuthError(error);
  }
}
