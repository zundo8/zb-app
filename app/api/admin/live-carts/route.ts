import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch carts that have items, along with customer details
    const carts = await prisma.cart.findMany({
      where: {
        items: {
          some: {}
        }
      },
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
        items: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(carts);
  } catch (error: any) {
    console.error("Fetch live carts error:", error);
    return NextResponse.json({ error: "Failed to fetch live carts" }, { status: 500 });
  }
}
