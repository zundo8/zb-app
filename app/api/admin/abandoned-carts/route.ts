import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

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

    // Filter by status (including computed-on-read logic)
    if (statusFilter === "live") {
      andClauses.push({
        status: "active",
        lastActivityAt: { gt: abandonmentThreshold }
      });
    } else if (statusFilter === "abandoned") {
      andClauses.push({
        OR: [
          { status: "abandoned" },
          { status: "active", lastActivityAt: { lte: abandonmentThreshold } }
        ]
      });
    } else if (statusFilter === "converted") {
      andClauses.push({ status: "converted" });
    } else if (statusFilter === "expired") {
      andClauses.push({ status: "expired" });
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
          }
        }
      },
      orderBy: {
        lastActivityAt: "desc"
      },
      skip,
      take: limit
    });

    // Process carts to map final computed status
    let mappedCarts = carts.map((cart: any) => {
      let computedStatus = cart.status;
      if (cart.status === "active" && cart.lastActivityAt <= abandonmentThreshold) {
        computedStatus = "abandoned";
      }

      return {
        ...cart,
        computedStatus
      };
    });

    let finalTotal = total;

    // Fallback: If DB yields 0 carts or DB is down, fetch directly from Shopify Admin API checkouts
    if (mappedCarts.length === 0) {
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
        pagination: { total: mappedCarts.length, page: 1, limit: 20, totalPages: Math.ceil(mappedCarts.length / 20) || 1 }
      });
    } catch (e2) {
      return NextResponse.json({ error: "Failed to fetch abandoned carts" }, { status: 500 });
    }
  }
}
