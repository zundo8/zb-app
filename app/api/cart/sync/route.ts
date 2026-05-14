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

    // Ensure customer exists (to avoid foreign key constraint issues)
    const customer = await prisma.customer.findUnique({
      where: { id: auth.customerId }
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
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
      // Ensure we only process valid items
      const validItems = items.filter((item: any) => item.productId && item.variantId);
      
      await prisma.cartItem.createMany({
        data: validItems.map((item: any) => ({
          cartId: cart.id,
          productId: String(item.productId),
          variantId: String(item.variantId),
          handle: item.handle || null,
          title: item.title || "Product",
          price: parseFloat(String(item.price)) || 0,
          image: item.image || null,
          quantity: parseInt(String(item.quantity)) || 1,
          size: item.size || null,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cart sync error:", error);
    return NextResponse.json({ error: "Failed to sync cart" }, { status: 500 });
  }
}
