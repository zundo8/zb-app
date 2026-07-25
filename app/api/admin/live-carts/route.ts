import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const daysParam = parseInt(searchParams.get("days") || "7", 10);

    const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 200);
    const days = Math.max(isNaN(daysParam) ? 7 : daysParam, 1);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Fetch carts that have items and were updated recently
    const carts = await prisma.cart.findMany({
      where: {
        items: {
          some: {}
        },
        updatedAt: {
          gte: sinceDate
        }
      },
      take: limit,
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

