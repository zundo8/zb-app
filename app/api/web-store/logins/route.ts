import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Fetch logins that are NOT from the Mobile App (so Web Store logins)
    const [logins, total] = await Promise.all([
      prisma.appLogin.findMany({
        where: {
          NOT: {
            userAgent: "Mobile App",
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: skip,
      }),
      prisma.appLogin.count({
        where: {
          NOT: {
            userAgent: "Mobile App",
          },
        },
      }),
    ]);

    // Gather unique phone numbers from this batch of logins
    const phones = Array.from(new Set(logins.map((l: any) => l.phone)));

    // Query both Order and WebStoreOrder tables to check order status
    // 1. Web Store orders (placed on the web checkout)
    const webStoreOrders = await prisma.webStoreOrder.findMany({
      where: {
        customerPhone: {
          in: phones,
        },
      },
      select: {
        customerPhone: true,
        orderNumber: true,
      },
    });

    // Create a map of phone -> count of web store orders
    const webStoreOrdersMap = new Map<string, number>();
    webStoreOrders.forEach((o: any) => {
      const p = o.customerPhone;
      webStoreOrdersMap.set(p, (webStoreOrdersMap.get(p) || 0) + 1);
    });

    // 2. Local Customer and standard shopify Orders synced in NextAuth
    const cleanPhones = phones.map((p: any) => p.replace(/\D/g, ""));
    const last10DigitsList = cleanPhones.map((p: any) => p.slice(-10)).filter(Boolean);

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { phone: { in: phones } },
          { phone: { in: cleanPhones.map((p: any) => `+${p}`) } },
          ...last10DigitsList.map((digits: any) => ({
            phone: { contains: digits }
          }))
        ]
      },
      select: {
        phone: true,
        ordersCount: true,
      }
    });

    // Create a map of clean phone digits -> customer order count
    const customerOrdersMap = new Map<string, number>();
    customers.forEach((c: any) => {
      if (c.phone) {
        const cleanP = c.phone.replace(/\D/g, "");
        const currentVal = customerOrdersMap.get(cleanP) || 0;
        customerOrdersMap.set(cleanP, Math.max(currentVal, c.ordersCount || 0));
      }
    });

    // Enrich the logins with order count info
    const enrichedLogins = logins.map((login: any) => {
      const rawPhone = login.phone;
      const cleanPhone = rawPhone.replace(/\D/g, "");
      
      // Get orders from webstore orders table
      const webstoreCount = webStoreOrdersMap.get(rawPhone) || webStoreOrdersMap.get(`+${cleanPhone}`) || 0;
      
      // Get orders from Customer shopify sync
      let shopifyCount = 0;
      for (const [key, val] of customerOrdersMap.entries()) {
        if (cleanPhone.includes(key) || key.includes(cleanPhone) || (cleanPhone.length >= 10 && key.length >= 10 && cleanPhone.slice(-10) === key.slice(-10))) {
          shopifyCount = Math.max(shopifyCount, val);
        }
      }

      const totalOrders = webstoreCount + shopifyCount;
      const hasPurchased = totalOrders > 0;

      return {
        ...login,
        hasPurchased,
        orderCount: totalOrders,
      };
    });

    return NextResponse.json({ logins: enrichedLogins, total });
  } catch (error: any) {
    console.error("Fetch web-store logins error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
