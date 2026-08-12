import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isOrderValidConverted } from "@/lib/cartValidation";
import { buildCustomerIdentityOrClauses, areItemsIdentical } from "@/lib/cartCustomerMatch";

export const dynamic = "force-dynamic";

const validConvertedOrderClause = {
  OR: [
    {
      convertedOrder: {
        is: {
          NOT: [
            { status: { in: ["failed", "FAILED", "payment_failed", "payment_pending", "cancelled", "CANCELLED", "draft", "voided"] } },
            { paymentStatus: { in: ["failed", "FAILED", "payment_failed", "payment_pending", "cancelled", "CANCELLED", "voided"] } }
          ],
          OR: [
            { paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "refunded", "partially_refunded", "PAID", "SUCCESS", "success", "captured", "authorized", "approved"] } },
            { status: { in: ["approved", "open", "active", "fulfilled", "delivered", "shipped", "completed", "processing", "processed", "CONFIRMED", "confirmed", "placed", "synced", "closed"] } }
          ]
        }
      }
    },
    { status: "converted" },
    { convertedOrderId: { not: null } }
  ]
};

async function enrichCartsWithConversionData(carts: any[]) {
  if (!carts || carts.length === 0) {
    return { previousConversionMap: new Map<string, any>(), isRaceDuplicateMap: new Map<string, boolean>() };
  }

  const allOrClauses: any[] = [];
  for (const c of carts) {
    const clauses = buildCustomerIdentityOrClauses({
      customerId: c.customerId || c.customer?.id,
      email: c.email || c.customer?.email,
      phone: c.phone || c.customer?.phone,
      sessionToken: c.sessionToken,
    });
    allOrClauses.push(...clauses);
  }

  let convertedCarts: any[] = [];
  if (allOrClauses.length > 0) {
    convertedCarts = await prisma.cart.findMany({
      where: {
        ...validConvertedOrderClause,
        OR: allOrClauses,
      },
      include: {
        items: true,
        convertedOrder: {
          select: {
            id: true,
            internalOrderNumber: true,
            totalPrice: true,
            createdAt: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  const isRaceDuplicateMap = new Map<string, boolean>();
  const previousConversionMap = new Map<string, any>();

  for (const cart of carts) {
    const matchingConverted = convertedCarts.filter(conv => {
      if (conv.id === cart.id) return false;
      if (cart.customerId && conv.customerId === cart.customerId) return true;
      if (cart.email && conv.email && cart.email.trim().toLowerCase() === conv.email.trim().toLowerCase()) return true;
      if (cart.phone && conv.phone && cart.phone.trim() === conv.phone.trim()) return true;
      if (cart.sessionToken && conv.sessionToken && cart.sessionToken === conv.sessionToken) return true;
      return false;
    });

    if (matchingConverted.length > 0) {
      const latestConv = matchingConverted[0];
      const order = latestConv.convertedOrder;
      previousConversionMap.set(cart.id, {
        cartId: latestConv.id,
        orderId: order?.id || latestConv.convertedOrderId,
        internalOrderNumber: order?.internalOrderNumber || null,
        totalPrice: order?.totalPrice || latestConv.subtotal || 0,
        convertedAt: order?.createdAt || latestConv.updatedAt,
      });

      if (!cart.convertedOrderId && cart.status !== "converted") {
        const isDuplicate = matchingConverted.some(conv => {
          const convTime = new Date(conv.convertedOrder?.createdAt || conv.updatedAt).getTime();
          const cartTime = new Date(cart.createdAt).getTime();
          const diffMinutes = Math.abs(cartTime - convTime) / (1000 * 60);
          return diffMinutes <= 30 && areItemsIdentical(cart.items || [], conv.items || []);
        });
        isRaceDuplicateMap.set(cart.id, isDuplicate);
      } else {
        isRaceDuplicateMap.set(cart.id, false);
      }
    } else {
      previousConversionMap.set(cart.id, null);
      isRaceDuplicateMap.set(cart.id, false);
    }
  }

  return { previousConversionMap, isRaceDuplicateMap };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "all"; // all, live, abandoned, converted, expired
    const sourceFilter = searchParams.get("source") || "all"; // all, webstore, app
    const searchQuery = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const delaySetting = await prisma.whatsAppSetting.findFirst({
      where: { key: "delay_abandoned_cart_step1" }
    });
    const delayMinutes = delaySetting ? (parseInt(delaySetting.value, 10) || 5) : 5;
    const abandonmentThreshold = new Date(Date.now() - delayMinutes * 60 * 1000);

    const andClauses: any[] = [
      { items: { some: {} } }
    ];

    // Filter by source
    if (sourceFilter !== "all") {
      andClauses.push({ source: sourceFilter });
    }

    // Filter by status (using valid is: relation and scalar status filters)
    if (statusFilter === "live") {
      andClauses.push({
        status: "active",
        lastActivityAt: { gt: abandonmentThreshold },
        convertedOrderId: null
      });
    } else if (statusFilter === "abandoned") {
      andClauses.push({ convertedOrderId: null });
      andClauses.push({
        OR: [
          { status: "abandoned" },
          { status: "active", lastActivityAt: { lte: abandonmentThreshold } }
        ]
      });
    } else if (statusFilter === "converted") {
      andClauses.push(validConvertedOrderClause);
    } else if (statusFilter === "expired") {
      andClauses.push({
        status: "expired",
        convertedOrderId: null
      });
    }

    // Filter by search query (customer name, email, phone)
    if (searchQuery) {
      andClauses.push({
        OR: [
          { email: { contains: searchQuery, mode: "insensitive" } },
          { phone: { contains: searchQuery, mode: "insensitive" } },
          {
            customer: {
              OR: [
                { name: { contains: searchQuery, mode: "insensitive" } },
                { email: { contains: searchQuery, mode: "insensitive" } },
                { phone: { contains: searchQuery, mode: "insensitive" } }
              ]
            }
          }
        ]
      });
    }

    const where = { AND: andClauses };

    // Fetch the carts with relations (sorted by updatedAt desc so latest converted/updated carts appear first)
    const carts = await prisma.cart.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          }
        },
        items: true,
        convertedOrder: {
          select: {
            id: true,
            internalOrderNumber: true,
            totalPrice: true,
            createdAt: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      skip,
      take: limit
    });

    const { previousConversionMap, isRaceDuplicateMap } = await enrichCartsWithConversionData(carts);

    // Compute Summary Stats for Admin Dashboard KPI Header
    const rawAbandonedCarts = await prisma.cart.findMany({
      where: {
        items: { some: {} },
        convertedOrderId: null,
        OR: [
          { status: "abandoned" },
          { status: "active", lastActivityAt: { lte: abandonmentThreshold } }
        ]
      },
      include: { items: true, customer: true }
    });
    const { isRaceDuplicateMap: abandonedDuplicatesMap } = await enrichCartsWithConversionData(rawAbandonedCarts);
    const validAbandonedCount = rawAbandonedCarts.filter(c => !abandonedDuplicatesMap.get(c.id)).length;

    const [liveCount, convertedCount, expiredCount] = await Promise.all([
      prisma.cart.count({
        where: {
          items: { some: {} },
          status: "active",
          lastActivityAt: { gt: abandonmentThreshold },
          convertedOrderId: null
        }
      }),
      prisma.cart.count({
        where: {
          items: { some: {} },
          ...validConvertedOrderClause
        }
      }),
      prisma.cart.count({
        where: {
          items: { some: {} },
          status: "expired",
          convertedOrderId: null
        }
      })
    ]);

    const abandonedCount = validAbandonedCount;

    const convertedAggregate = await prisma.cart.aggregate({
      where: {
        items: { some: {} },
        ...validConvertedOrderClause
      },
      _sum: { subtotal: true }
    });

    const convertedRevenue = Math.round(convertedAggregate._sum.subtotal || 0);
    const totalTracked = liveCount + abandonedCount + convertedCount + expiredCount;
    const recoveryRate = (abandonedCount + convertedCount) > 0
      ? Math.round((convertedCount / (abandonedCount + convertedCount)) * 100)
      : 0;

    // Process carts to map final computed status and attach conversion context
    const mappedCarts = carts
      .filter((cart: any) => {
        const isDuplicate = isRaceDuplicateMap.get(cart.id);
        if (isDuplicate && (statusFilter === "abandoned" || statusFilter === "all")) {
          return false;
        }
        return true;
      })
      .map((cart: any) => {
        const order = cart.convertedOrder;
        const isValidConverted = isOrderValidConverted(order);
        const isExplicitlyConverted = cart.status === "converted" || Boolean(cart.convertedOrderId);

        let computedStatus = cart.status;
        if (isValidConverted || isExplicitlyConverted) {
          computedStatus = "converted";
        } else if (cart.status === "expired") {
          computedStatus = "expired";
        } else if (cart.lastActivityAt <= abandonmentThreshold || cart.status === "abandoned") {
          computedStatus = "abandoned";
        } else {
          computedStatus = "active";
        }

        return {
          ...cart,
          convertedOrder: order || null,
          convertedOrderId: cart.convertedOrderId || (order ? order.id : null),
          computedStatus,
          previousConversion: previousConversionMap.get(cart.id) || null
        };
      });

    // Total count for pagination adjusted for duplicates if statusFilter === "abandoned"
    const rawTotal = await prisma.cart.count({ where });
    const total = statusFilter === "abandoned" ? abandonedCount : rawTotal;

    return NextResponse.json({
      carts: mappedCarts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        totalTracked,
        liveCount,
        abandonedCount,
        convertedCount,
        expiredCount,
        convertedRevenue,
        recoveryRate
      }
    });

    return NextResponse.json({
      carts: mappedCarts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        totalTracked,
        liveCount,
        abandonedCount,
        convertedCount,
        expiredCount,
        convertedRevenue,
        recoveryRate
      }
    });
  } catch (error: any) {
    console.error("Fetch abandoned carts DB error, falling back to Shopify API:", error);
    try {
      const { shopifyFetch } = await import("@/lib/shopify-client");
      const shopifyRes: any = await shopifyFetch("checkouts.json", { limit: "250" });
      const checkouts = shopifyRes?.checkouts || [];
      const mappedCarts = checkouts.map((co: any) => ({
        id: String(co.id || co.token),
        customerId: co.customer?.id ? String(co.customer.id) : null,
        sessionToken: co.token || String(co.id),
        source: "webstore",
        status: "abandoned",
        computedStatus: "abandoned",
        phone: co.phone || co.shipping_address?.phone || null,
        email: co.email || co.customer?.email || null,
        subtotal: parseFloat(co.subtotal_price || co.total_price || "0"),
        currency: co.currency || "INR",
        createdAt: co.created_at,
        updatedAt: co.updated_at,
        lastActivityAt: co.updated_at,
        customer: co.customer ? {
          id: String(co.customer.id),
          name: `${co.customer.first_name || ""} ${co.customer.last_name || ""}`.trim() || "Customer",
          email: co.customer.email,
          phone: co.customer.phone || co.phone,
        } : null,
        items: (co.line_items || []).map((li: any) => ({
          id: String(li.key || li.variant_id),
          title: li.title,
          price: parseFloat(li.price || "0"),
          quantity: li.quantity
        }))
      }));
      return NextResponse.json({
        carts: mappedCarts,
        pagination: { total: mappedCarts.length, page: 1, limit: 20, totalPages: Math.ceil(mappedCarts.length / 20) || 1 },
        stats: {
          totalTracked: mappedCarts.length,
          liveCount: 0,
          abandonedCount: mappedCarts.length,
          convertedCount: 0,
          expiredCount: 0,
          convertedRevenue: 0,
          recoveryRate: 0
        }
      });
    } catch (e2) {
      return NextResponse.json({ error: "Failed to fetch abandoned carts" }, { status: 500 });
    }
  }
}
