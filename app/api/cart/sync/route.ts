import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAppAuthFromRequest, resolveAuthCustomer } from "@/lib/appAuth";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, guestId, name, email, phone } = body;
    const auth = getAppAuthFromRequest(req);
    const customer = auth ? await resolveAuthCustomer(auth) : null;
    let customerId = customer?.id;

    if (!customerId && !guestId) {
      return NextResponse.json({ error: "Unauthorized or Missing guestId" }, { status: 401 });
    }

    // If guest mode, find or create a placeholder customer
    if (!customerId && guestId) {
      const shop = await prisma.shop.findFirst();
      if (!shop) return NextResponse.json({ error: "Shop not configured" }, { status: 500 });

      const guestIdentifier = `GUEST_${guestId}`;
      const guestCustomer = await prisma.customer.upsert({
        where: { shopifyId: guestIdentifier },
        update: { 
          updatedAt: new Date(),
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
        },
        create: {
          shopifyId: guestIdentifier,
          shopId: shop.id,
          name: name || "Guest Node",
          email: email || "guest@zicabella.com",
          phone: phone || null,
        }
      });
      customerId = guestCustomer.id;
    }

    if (!customerId) {
       return NextResponse.json({ error: "Failed to resolve identity" }, { status: 500 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
    }


    // Upsert the cart for this customer
    const cart = await prisma.cart.upsert({
      where: { customerId: customerId },
      create: { customerId: customerId },
      update: { updatedAt: new Date() },
    });

    let syncedCount = 0;

    // Replace all items atomically
    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      if (items.length > 0) {
        const validItems = items.filter((item: any) => item.productId && item.variantId);
        if (validItems.length > 0) {
          const result = await tx.cartItem.createMany({
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
          syncedCount = result.count;
        }
      }
    });

    return NextResponse.json({ success: true, count: syncedCount }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Cart sync error:", error);
    return NextResponse.json({ error: "Failed to sync cart", details: error.message }, { status: 500, headers: corsHeaders });
  }
}
