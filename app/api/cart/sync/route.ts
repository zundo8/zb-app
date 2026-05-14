import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAppAuthFromRequest } from "@/lib/appAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = getAppAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items } = await req.json();

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
    }

    // Upsert the cart for this customer
    const cart = await prisma.cart.upsert({
      where: { customerId: auth.customerId },
      create: { customerId: auth.customerId },
      update: { updatedAt: new Date() },
    });

    // Replace all items (simplest way to keep in sync)
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    if (items.length > 0) {
      await prisma.cartItem.createMany({
        data: items.map((item: any) => ({
          cartId: cart.id,
          productId: String(item.productId),
          variantId: String(item.variantId),
          handle: item.handle,
          title: item.title,
          price: parseFloat(item.price) || 0,
          image: item.image,
          quantity: parseInt(item.quantity) || 1,
          size: item.size,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cart sync error:", error);
    return NextResponse.json({ error: "Failed to sync cart" }, { status: 500 });
  }
}
