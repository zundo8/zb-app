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
    const mappedCarts = carts.map((cart: any) => {
      let computedStatus = cart.status;
      if (cart.status === "active" && cart.lastActivityAt <= abandonmentThreshold) {
        computedStatus = "abandoned";
      }

      return {
        ...cart,
        computedStatus
      };
    });

    return NextResponse.json({
      carts: mappedCarts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Fetch abandoned carts error:", error);
    return NextResponse.json({ error: "Failed to fetch abandoned carts" }, { status: 500 });
  }
}
