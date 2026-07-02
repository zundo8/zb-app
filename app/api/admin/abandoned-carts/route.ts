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

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Build the query where clause
    const where: any = {
      items: {
        some: {} // Carts must have items
      }
    };

    // Filter by source
    if (sourceFilter !== "all") {
      where.source = sourceFilter;
    }

    // Filter by status (including computed-on-read logic)
    if (statusFilter === "live") {
      where.status = "active";
      where.lastActivityAt = { gt: thirtyMinutesAgo };
    } else if (statusFilter === "abandoned") {
      where.OR = [
        { status: "abandoned" },
        { status: "active", lastActivityAt: { lte: thirtyMinutesAgo } }
      ];
    } else if (statusFilter === "converted") {
      where.status = "converted";
    } else if (statusFilter === "expired") {
      where.status = "expired";
    }

    // Filter by search query (customer name, email, phone)
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery, mode: "insensitive" } },
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
      ];
    }

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
    const mappedCarts = carts.map(cart => {
      let computedStatus = cart.status;
      if (cart.status === "active" && cart.lastActivityAt <= thirtyMinutesAgo) {
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
