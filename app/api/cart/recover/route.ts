import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing cart ID" }, { status: 400 });
    }

    const cart = await prisma.cart.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!cart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    return NextResponse.json(cart);
  } catch (error: any) {
    console.error("Cart recovery fetch error:", error);
    return NextResponse.json({ error: "Failed to recover cart" }, { status: 500 });
  }
}
