import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAppAuthFromRequest, resolveAuthCustomer } from "@/lib/appAuth";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

import { getCorsHeaders, handleCorsOptions } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsOptions(req);
}

import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rateLimitResult = await checkRateLimit(req, "cart-sync", { maxRequests: 60, windowMs: 60_000 });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  const corsHeaders = getCorsHeaders(req);
  try {
    const body = await req.json();
    const { 
      items, guestId, name, email, phone, source,
      city, state, zip, country, latitude, longitude 
    } = body;
    
    // 1. Resolve customer identity (Mobile Auth vs NextAuth Session)
    const auth = getAppAuthFromRequest(req);
    const appCustomer = auth ? await resolveAuthCustomer(auth) : null;
    let customerId = appCustomer?.id;

    if (!customerId) {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        const sessionUser = session.user as any;
        const userEmail = sessionUser.email;
        const userId = sessionUser.id;
        const dbCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              ...(userId ? [{ id: userId }] : []),
              ...(userEmail ? [{ email: userEmail }] : [])
            ]
          }
        });
        customerId = dbCustomer?.id;
      }
    }

    // 2. Find or create an active cart session
    let cart = null;

    if (customerId) {
      // Find active cart for this customer
      cart = await prisma.cart.findFirst({
        where: { customerId: customerId, status: "active" }
      });

      // If customer has no active cart, but we have a guestId, try to associate the guest cart
      if (!cart && guestId) {
        cart = await prisma.cart.findFirst({
          where: { sessionToken: guestId, status: "active" }
        });
        if (cart) {
          cart = await prisma.cart.update({
            where: { id: cart.id },
            data: { customerId: customerId }
          });
        }
      }
    } else if (guestId) {
      // Find guest active cart
      cart = await prisma.cart.findFirst({
        where: { sessionToken: guestId, status: "active" }
      });
    }

    const calculatedSubtotal = Array.isArray(items) 
      ? items.reduce((sum: number, item: any) => sum + (parseFloat(String(item.price || 0)) * (parseInt(String(item.quantity || 1)) || 1)), 0)
      : 0;

    const cartSource = source || (auth ? "app" : "webstore");

    if (!cart) {
      // Create new cart session
      cart = await prisma.cart.create({
        data: {
          customerId: customerId || null,
          sessionToken: guestId || null,
          source: cartSource,
          status: "active",
          phone: phone || null,
          email: email || null,
          subtotal: calculatedSubtotal,
          lastActivityAt: new Date(),
          city: city || null,
          state: state || null,
          zip: zip || null,
          country: country || null,
          latitude: latitude !== undefined && latitude !== null ? parseFloat(String(latitude)) : null,
          longitude: longitude !== undefined && longitude !== null ? parseFloat(String(longitude)) : null,
        }
      });
    } else {
      // Update existing cart details
      cart = await prisma.cart.update({
        where: { id: cart.id },
        data: {
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          subtotal: calculatedSubtotal,
          phone: phone || undefined,
          email: email || undefined,
          source: cartSource, // Ensure source is kept up-to-date
          city: city || undefined,
          state: state || undefined,
          zip: zip || undefined,
          country: country || undefined,
          latitude: latitude !== undefined && latitude !== null ? parseFloat(String(latitude)) : undefined,
          longitude: longitude !== undefined && longitude !== null ? parseFloat(String(longitude)) : undefined,
        }
      });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid items format" }, { status: 400, headers: corsHeaders });
    }

    let syncedCount = 0;

    // Replace all items atomically
    await prisma.$transaction(async (tx: any) => {
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

