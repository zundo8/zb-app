import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isOrderValidConverted } from "@/lib/cartValidation";

export const dynamic = "force-dynamic";

function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits || null;
}

const validConvertedOrderClause = {
  convertedOrder: {
    isNot: null,
    NOT: [
      { status: { in: ["failed", "FAILED", "payment_failed", "payment_pending", "cancelled", "CANCELLED", "draft", "voided"] } },
      { paymentStatus: { in: ["failed", "FAILED", "payment_failed", "payment_pending", "cancelled", "CANCELLED", "voided"] } }
    ],
    OR: [
      { paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "refunded", "partially_refunded", "PAID", "SUCCESS", "success", "captured"] } },
      {
        AND: [
          { paymentMethod: { in: ["COD", "cod", "Cash on Delivery", "cash_on_delivery"] } },
          { status: { in: ["approved", "open", "fulfilled", "delivered", "shipped", "completed", "processing", "processed", "CONFIRMED", "confirmed", "placed"] } }
        ]
      }
    ]
  }
};

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

    // 1a. Quick Auto-Reconciliation: match unlinked active/abandoned carts ONLY with completed/processed paid or COD Orders
    try {
      const unconvertedCarts = await prisma.cart.findMany({
        where: {
          convertedOrderId: null,
          status: { notIn: ["converted", "merged"] },
          items: { some: {} }
        },
        take: 50,
        orderBy: { createdAt: "desc" }
      });

      for (const cart of unconvertedCarts) {
        const normCartPhone = normalizePhone(cart.phone);
        
        const matchedOrder = await prisma.order.findFirst({
          where: {
            createdAt: { gte: new Date(cart.createdAt.getTime() - 60 * 60 * 1000) },
            NOT: [
              { status: { in: ["failed", "FAILED", "payment_failed", "payment_pending", "cancelled", "CANCELLED", "draft", "voided"] } },
              { paymentStatus: { in: ["failed", "FAILED", "payment_failed", "payment_pending", "cancelled", "CANCELLED", "voided"] } }
            ],
            OR: [
              { paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "refunded", "partially_refunded", "PAID", "SUCCESS", "success", "captured"] } },
              {
                AND: [
                  { paymentMethod: { in: ["COD", "cod", "Cash on Delivery", "cash_on_delivery"] } },
                  { status: { in: ["approved", "open", "fulfilled", "delivered", "shipped", "completed", "processing", "processed", "CONFIRMED", "confirmed", "placed"] } }
                ]
              }
            ],
            AND: [
              {
                OR: [
                  ...(cart.customerId ? [{ customerId: cart.customerId }] : []),
                  ...(cart.email ? [{ customer: { email: { equals: cart.email, mode: "insensitive" as const } } }] : []),
                  ...(normCartPhone ? [{ customer: { phone: { contains: normCartPhone } } }] : []),
                  ...(normCartPhone ? [{ shippingAddress: { contains: normCartPhone } }] : []),
                  ...(cart.email ? [{ shippingAddress: { contains: cart.email } }] : [])
                ]
              }
            ]
          },
          orderBy: { createdAt: "asc" }
        });

        if (matchedOrder) {
          await prisma.cart.update({
            where: { id: cart.id },
            data: {
              status: "converted",
              convertedOrderId: matchedOrder.id
            }
          });
        }
      }
    } catch (reconcileErr: any) {
      console.warn("[Abandoned Carts API] Auto-reconciliation warning:", reconcileErr?.message);
    }

    // 1b. Self-Healing DB Repair: Unlink historical carts that were linked to failed/pending/cancelled orders
    try {
      const potentiallyInvalidCarts = await prisma.cart.findMany({
        where: {
          OR: [
            { status: "converted" },
            { convertedOrderId: { not: null } }
          ]
        },
        include: {
          convertedOrder: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              paymentMethod: true
            }
          }
        },
        take: 100
      });

      for (const cart of potentiallyInvalidCarts) {
        const isValid = isOrderValidConverted(cart.convertedOrder);
        if (!isValid) {
          const restoredStatus = cart.lastActivityAt <= abandonmentThreshold ? "abandoned" : "active";
          await prisma.cart.update({
            where: { id: cart.id },
            data: {
              convertedOrderId: null,
              status: restoredStatus
            }
          });
        }
      }
    } catch (cleanErr: any) {
      console.warn("[Abandoned Carts API] Self-healing cleanup warning:", cleanErr?.message);
    }

    const andClauses: any[] = [
      { items: { some: {} } }
    ];

    // Filter by source
    if (sourceFilter !== "all") {
      andClauses.push({ source: sourceFilter });
    }

    // Filter by status (strict conversion validation)
    if (statusFilter === "live") {
      andClauses.push({
        status: "active",
        lastActivityAt: { gt: abandonmentThreshold },
        NOT: [validConvertedOrderClause]
      });
    } else if (statusFilter === "abandoned") {
      andClauses.push({
        NOT: [validConvertedOrderClause],
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
        NOT: [validConvertedOrderClause]
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

    // Get total count for pagination
    const total = await prisma.cart.count({ where });

    // Fetch the carts with relations
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
        lastActivityAt: "desc"
      },
      skip,
      take: limit
    });

    // Compute Summary Stats for Admin Dashboard KPI Header
    const [liveCount, abandonedCount, convertedCount, expiredCount] = await Promise.all([
      prisma.cart.count({
        where: {
          items: { some: {} },
          status: "active",
          lastActivityAt: { gt: abandonmentThreshold },
          NOT: [validConvertedOrderClause]
        }
      }),
      prisma.cart.count({
        where: {
          items: { some: {} },
          NOT: [validConvertedOrderClause],
          OR: [
            { status: "abandoned" },
            { status: "active", lastActivityAt: { lte: abandonmentThreshold } }
          ]
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
          NOT: [validConvertedOrderClause]
        }
      })
    ]);

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

    // Process carts to map final computed status
    let mappedCarts = carts.map((cart: any) => {
      const order = cart.convertedOrder;
      const isValidConverted = isOrderValidConverted(order);

      let computedStatus = cart.status;
      if (isValidConverted) {
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
        convertedOrder: isValidConverted ? order : null,
        convertedOrderId: isValidConverted ? cart.convertedOrderId : null,
        computedStatus
      };
    });

    let finalTotal = total;

    // Fallback: If DB yields 0 total tracked carts and no filters active, fetch directly from Shopify Admin API checkouts
    if (totalTracked === 0 && statusFilter === "all" && sourceFilter === "all" && !searchQuery) {
      try {
        const { shopifyFetch } = await import("@/lib/shopify-client");
        const shopifyRes: any = await shopifyFetch("checkouts.json", { limit: "250" });
        const checkouts = shopifyRes?.checkouts || [];
        
        mappedCarts = checkouts.map((co: any) => ({
          id: String(co.id || co.token),
          customerId: co.customer?.id ? String(co.customer.id) : null,
          sessionToken: co.token || String(co.id),
          source: "webstore",
          status: "abandoned",
          computedStatus: "abandoned",
          phone: co.phone || co.shipping_address?.phone || co.billing_address?.phone || null,
          email: co.email || co.customer?.email || null,
          subtotal: parseFloat(co.subtotal_price || co.total_price || "0"),
          currency: co.currency || "INR",
          createdAt: co.created_at || co.updated_at,
          updatedAt: co.updated_at,
          lastActivityAt: co.updated_at || co.created_at,
          abandonedAt: co.completed_at ? null : co.updated_at,
          city: co.shipping_address?.city || co.billing_address?.city || null,
          country: co.shipping_address?.country || co.billing_address?.country || "India",
          state: co.shipping_address?.province || co.billing_address?.province || null,
          zip: co.shipping_address?.zip || co.billing_address?.zip || null,
          customer: co.customer ? {
            id: String(co.customer.id),
            name: `${co.customer.first_name || ""} ${co.customer.last_name || ""}`.trim() || "Customer",
            email: co.customer.email,
            phone: co.customer.phone || co.phone,
            image: null
          } : (co.email || co.phone || co.shipping_address) ? {
            id: `guest_${co.id}`,
            name: `${co.shipping_address?.first_name || ""} ${co.shipping_address?.last_name || ""}`.trim() || "Guest Customer",
            email: co.email,
            phone: co.phone || co.shipping_address?.phone,
            image: null
          } : null,
          items: (co.line_items || []).map((li: any) => ({
            id: String(li.key || li.variant_id || Math.random()),
            cartId: String(co.id || co.token),
            productId: String(li.product_id || ""),
            variantId: String(li.variant_id || ""),
            title: li.title || "Product Item",
            price: parseFloat(li.price || "0"),
            quantity: li.quantity || 1,
            size: li.variant_title || null,
            image: li.image_url || null
          }))
        }));

        finalTotal = mappedCarts.length;
      } catch (shopifyErr: any) {
        console.warn("[Abandoned Carts API] Shopify checkouts fallback error:", shopifyErr.message);
      }
    }

    return NextResponse.json({
      carts: mappedCarts,
      pagination: {
        total: finalTotal,
        page,
        limit,
        totalPages: Math.ceil(finalTotal / limit) || 1
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
    console.error("Fetch abandoned carts error:", error);
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

