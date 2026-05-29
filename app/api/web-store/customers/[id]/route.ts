import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch customer details
    const customer = await prisma.webStoreCustomer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        addresses: true,
        defaultAddressIndex: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Fetch this customer's full order history
    const orderHistory = await prisma.webStoreOrder.findMany({
      where: {
        customerEmail: customer.email,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      customer,
      orderHistory,
    });
  } catch (error: any) {
    console.error("[Web Store Single Customer GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
