import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchAllCustomers } from '@/lib/shopify-admin';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';
import { mergeAllDuplicateCustomers } from '@/lib/services/customerDeduplicationService';

export const dynamic = 'force-dynamic';

function getCleanPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : null;
}

function getCleanEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = String(email).trim().toLowerCase();
  return trimmed.length > 3 && trimmed.includes('@') ? trimmed : null;
}

export async function GET(req: Request) {
  try {
    await requirePermission('CUSTOMERS', 'view');
    const url = new URL(req.url);
    const format = url.searchParams.get('format');
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

    // Fire-and-forget background deduplication & Shopify sync on page 1
    if (page === 1 && !search) {
      (async () => {
        try {
          // 1. Run database-wide deduplication sweeper
          await mergeAllDuplicateCustomers();

          // 2. Sync Shopify customers safely without creating duplicate email/phone records
          const shop = await prisma.shop.findFirst();
          if (shop) {
            const shopifyCustomers = await fetchAllCustomers(100).catch(() => []);
            for (const sc of shopifyCustomers) {
              const shopifyId = String(sc.id);
              const email = getCleanEmail(sc.email);
              const phone = sc.phone || null;
              const name = `${sc.first_name || ""} ${sc.last_name || ""}`.trim() || email || phone || "Customer";

              // Check if customer already exists by shopifyId, email, or phone
              const existing = await prisma.customer.findFirst({
                where: {
                  OR: [
                    { shopifyId },
                    ...(email ? [{ email }] : []),
                    ...(phone ? [{ phone }] : []),
                  ],
                },
              });

              if (existing) {
                await prisma.customer.update({
                  where: { id: existing.id },
                  data: {
                    shopifyId,
                    ...(email ? { email } : {}),
                    ...(phone ? { phone } : {}),
                    name: existing.name && existing.name !== 'Customer' ? existing.name : name,
                    ordersCount: Math.max(existing.ordersCount, sc.orders_count || 0),
                    totalSpent: Math.max(existing.totalSpent, parseFloat(sc.total_spent || "0")),
                  },
                }).catch(() => {});
              } else {
                await prisma.customer.create({
                  data: {
                    shopifyId,
                    shopId: shop.id,
                    email,
                    phone,
                    name,
                    ordersCount: sc.orders_count || 0,
                    totalSpent: parseFloat(sc.total_spent || "0"),
                  },
                }).catch(() => {});
              }
            }
          }
        } catch (e: any) {
          console.error("[Customers Sync/Deduplication BG] Error:", e.message);
        }
      })();
    }

    // Fetch DB customers
    const dbCustomers = await prisma.customer.findMany({
      where: customerWhere,
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Take larger batch to allow in-memory deduplication
      skip: offset,
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: true },
        },
      },
    });

    // In-memory deduplication & aggregation by unique email / phone
    const uniqueCustomersMap = new Map<string, any>();
    const seenIds = new Set<string>();

    function isOrderFulfilled(status?: string | null): boolean {
      if (!status) return false;
      const s = status.toLowerCase().trim();
      return s === 'fulfilled' || s === 'shipped' || s === 'delivered';
    }

    for (const c of dbCustomers) {
      if (seenIds.has(c.id)) continue;

      const emailKey = getCleanEmail(c.email);
      const phoneKey = getCleanPhone(c.phone);
      const dedupKey = emailKey ? `email:${emailKey}` : phoneKey ? `phone:${phoneKey}` : `id:${c.id}`;

      if (uniqueCustomersMap.has(dedupKey)) {
        // Merge order stats into existing customer record in payload
        const existing = uniqueCustomersMap.get(dedupKey);
        existing.totalOrders += c.ordersCount || c.orders.length;
        const cFulfilledOrders = c.orders.filter((o: any) => isOrderFulfilled(o.fulfillmentStatus));
        existing.totalSpent += cFulfilledOrders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
        
        // Merge orders list
        const existingOrderIds = new Set(existing.orders.map((o: any) => o.id));
        for (const o of c.orders) {
          if (!existingOrderIds.has(o.id)) {
            existing.orders.push({
              id: o.id,
              shopifyOrderId: o.shopifyOrderId,
              status: o.status,
              totalPrice: o.totalPrice || 0,
              paymentStatus: o.paymentStatus,
              fulfillmentStatus: o.fulfillmentStatus,
              createdAt: o.createdAt,
              items: o.items.map((i: any) => ({
                id: i.id,
                title: i.title,
                quantity: i.quantity,
                price: i.price,
                sku: i.sku,
              })),
            });
          }
        }
        seenIds.add(c.id);
        continue;
      }

      const displayName = c.name || c.email || (c.shopifyId !== 'anonymous' ? c.shopifyId : 'Anonymous User');
      const totalOrders = c.ordersCount || c.orders.length;
      const fulfilledOrders = c.orders.filter((o: any) => isOrderFulfilled(o.fulfillmentStatus));
      const totalSpent = fulfilledOrders.reduce((sum: any, o: any) => sum + (o.totalPrice || 0), 0);

      const customerObj = {
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
        orders: c.orders.map((o: any) => ({
          id: o.id,
          shopifyOrderId: o.shopifyOrderId,
          status: o.status,
          totalPrice: o.totalPrice || 0,
          paymentStatus: o.paymentStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          createdAt: o.createdAt,
          items: o.items.map((i: any) => ({
            id: i.id,
            title: i.title,
            quantity: i.quantity,
            price: i.price,
            sku: i.sku,
          })),
        })),
      };

      uniqueCustomersMap.set(dedupKey, customerObj);
      seenIds.add(c.id);
    }

    let payload = Array.from(uniqueCustomersMap.values()).slice(0, limit);
    let totalCount = await prisma.customer.count({ where: customerWhere }).catch(() => 0);

    // Fallback: If DB returns 0 customers, fetch live customers directly from Shopify Admin API
    if (payload.length === 0) {
      try {
        const { shopifyFetch } = await import("@/lib/shopify-client");
        const res: any = await shopifyFetch("customers.json", { limit: String(limit || 50) });
        const shopifyCustomers = res?.customers || [];
        payload = shopifyCustomers.map((sc: any) => ({
          id: String(sc.id),
          shopifyId: String(sc.id),
          email: sc.email,
          name: `${sc.first_name || ""} ${sc.last_name || ""}`.trim() || sc.email || "Customer",
          phone: sc.phone || (sc.default_address?.phone) || null,
          createdAt: sc.created_at,
          lastLoginAt: sc.updated_at,
          totalOrders: sc.orders_count || 0,
          totalSpent: parseFloat(sc.total_spent || "0"),
          tags: sc.tags || '',
          orders: []
        }));
        totalCount = payload.length;
      } catch (shopifyErr: any) {
        console.warn("[Customers API] Shopify fallback error:", shopifyErr.message);
      }
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
    try {
      const { shopifyFetch } = await import("@/lib/shopify-client");
      const res: any = await shopifyFetch("customers.json", { limit: "50" });
      const shopifyCustomers = res?.customers || [];
      const payload = shopifyCustomers.map((sc: any) => ({
        id: String(sc.id),
        shopifyId: String(sc.id),
        email: sc.email,
        name: `${sc.first_name || ""} ${sc.last_name || ""}`.trim() || sc.email || "Customer",
        phone: sc.phone || (sc.default_address?.phone) || null,
        createdAt: sc.created_at,
        totalOrders: sc.orders_count || 0,
        totalSpent: parseFloat(sc.total_spent || "0"),
        tags: sc.tags || '',
        orders: []
      }));
      return NextResponse.json({
        success: true,
        customers: payload,
        total: payload.length,
        page: 1,
        limit: 50,
        hasMore: false,
      }, { status: 200 });
    } catch (e2) {
      return handleAuthError(error);
    }
  }
}
