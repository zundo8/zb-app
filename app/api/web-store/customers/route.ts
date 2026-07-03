import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";

    const where: any = {};
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ];
    }

    // Fetch customers
    const customers = await prisma.webStoreCustomer.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        defaultAddressIndex: true,
        addresses: true
      }
    });

    // Map each customer to enrich them with order history count
    const enrichedCustomers = await Promise.all(
      customers.map(async (customer: any) => {
        const ordersCount = await prisma.webStoreOrder.count({
          where: {
            customerEmail: customer.email,
          },
        });

        // Sum of all paid order amounts
        const paidAggregate = await prisma.webStoreOrder.aggregate({
          where: {
            customerEmail: customer.email,
            paymentStatus: "paid",
          },
          _sum: {
            totalAmount: true,
          },
        });
        const totalSpent = Number(paidAggregate._sum.totalAmount || 0);

        return {
          ...customer,
          ordersCount,
          totalSpent,
        };
      })
    );

    return NextResponse.json({ customers: enrichedCustomers });
  } catch (error: any) {
    console.error("[Web Store Customers GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
