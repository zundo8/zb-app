import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getClientIP, lookupIpGeo } from "@/lib/ip-geo";
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

    // ── IP Geolocation Fallback ──
    // If client didn't provide geo data (user denied/ignored location prompt),
    // derive city/state/country from IP. This ensures every cart record has
    // at least IP-level location for the abandoned carts admin page.
    let finalCity = city || null;
    let finalState = state || null;
    let finalZip = zip || null;
    let finalCountry = country || null;
    let finalLat = latitude !== undefined && latitude !== null ? parseFloat(String(latitude)) : null;
    let finalLng = longitude !== undefined && longitude !== null ? parseFloat(String(longitude)) : null;

    if (!city && !state && !country) {
      const ipGeo = await lookupIpGeo(getClientIP(req), req);
      if (ipGeo) {
        finalCity = ipGeo.city || null;
        finalState = ipGeo.region || null;
        finalCountry = ipGeo.country || null;
        finalLat = ipGeo.lat ?? null;
        finalLng = ipGeo.lng ?? null;
        // No zip from IP geo — leave as-is
      }
    }
    // 1. Resolve customer identity (Mobile Auth vs NextAuth Session vs Guest Email/Phone Match)
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

    // Fallback: match customer by guest phone or email if provided
    if (!customerId && (phone || email)) {
      const dbCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            ...(email ? [{ email: { equals: String(email).trim(), mode: "insensitive" as const } }] : []),
            ...(phone ? [{ phone: String(phone).trim() }] : [])
          ]
        }
      });
      if (dbCustomer) customerId = dbCustomer.id;
    }

    // Resolve customer profile default phone and email if logged in
    let customerPhone = null;
    let customerEmail = null;
    if (customerId) {
      const dbCustomer = await prisma.customer.findUnique({
        where: { id: customerId }
      });
      if (dbCustomer) {
        customerPhone = dbCustomer.phone;
        customerEmail = dbCustomer.email;
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
        const existingSession = await prisma.cart.findUnique({
          where: { sessionToken: guestId }
        });
        if (existingSession) {
          if (existingSession.status === "active" || existingSession.status === "abandoned" || existingSession.status === "expired") {
            cart = await prisma.cart.update({
              where: { id: existingSession.id },
              data: { customerId: customerId, status: "active", abandonedAt: null }
            });
          } else {
            // Converted or merged cart: release sessionToken so new cart can be created
            await prisma.cart.update({
              where: { id: existingSession.id },
              data: { sessionToken: null }
            });
          }
        }
      } else if (cart && guestId) {
        // Customer has an active cart, and we also have a guestId.
        const guestCart = await prisma.cart.findUnique({
          where: { sessionToken: guestId }
        });
        if (guestCart && guestCart.id !== cart.id) {
          if (guestCart.status === "active") {
            await prisma.cart.update({
              where: { id: guestCart.id },
              data: { status: "merged", customerId: customerId, sessionToken: null }
            });
          } else if (guestCart.status === "converted" || guestCart.status === "merged") {
            await prisma.cart.update({
              where: { id: guestCart.id },
              data: { sessionToken: null }
            });
          }
        }
      }
    } else if (guestId) {
      // Find guest cart by sessionToken
      const existingSession = await prisma.cart.findUnique({
        where: { sessionToken: guestId }
      });
      if (existingSession) {
        if (existingSession.status === "active" || existingSession.status === "abandoned" || existingSession.status === "expired") {
          cart = existingSession;
          if (existingSession.status !== "active") {
            await prisma.cart.update({
              where: { id: existingSession.id },
              data: { status: "active", abandonedAt: null }
            });
          }
        } else {
          // Previously converted or merged cart: release sessionToken from old cart
          await prisma.cart.update({
            where: { id: existingSession.id },
            data: { sessionToken: null }
          });
        }
      }
    }

    const calculatedSubtotal = Array.isArray(items) 
      ? items.reduce((sum: number, item: any) => sum + (parseFloat(String(item.price || 0)) * (parseInt(String(item.quantity || 1)) || 1)), 0)
      : 0;

    const cartSource = source || (auth ? "app" : "webstore");

    if (!cart) {
      // Create new cart session safely
      try {
        cart = await prisma.cart.create({
          data: {
            customerId: customerId || null,
            sessionToken: guestId || null,
            source: cartSource,
            status: "active",
            phone: phone || customerPhone || null,
            email: email || customerEmail || null,
            subtotal: calculatedSubtotal,
            lastActivityAt: new Date(),
            city: finalCity,
            state: finalState,
            zip: finalZip,
            country: finalCountry,
            latitude: finalLat,
            longitude: finalLng,
          }
        });
      } catch (createErr: any) {
        // If unique constraint collision happens on sessionToken, release token and retry creation
        if (createErr.code === 'P2002' && guestId) {
          await prisma.cart.updateMany({
            where: { sessionToken: guestId },
            data: { sessionToken: null }
          });
          cart = await prisma.cart.create({
            data: {
              customerId: customerId || null,
              sessionToken: guestId,
              source: cartSource,
              status: "active",
              phone: phone || customerPhone || null,
              email: email || customerEmail || null,
              subtotal: calculatedSubtotal,
              lastActivityAt: new Date(),
              city: finalCity,
              state: finalState,
              zip: finalZip,
              country: finalCountry,
              latitude: finalLat,
              longitude: finalLng,
            }
          });
        } else {
          throw createErr;
        }
      }
    } else {
      // Update existing cart details
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        subtotal: calculatedSubtotal,
        phone: phone || customerPhone || cart.phone || undefined,
        email: email || customerEmail || cart.email || undefined,
        source: cartSource,
        status: cart.status === "converted" ? "converted" : "active",
        abandonedAt: cart.status === "converted" ? cart.abandonedAt : null,
      };

      // Ensure location fields are updated if new values are available or if cart previously missed them
      if (finalCity !== null && finalCity !== undefined) updateData.city = finalCity;
      else if (!cart.city && finalCity) updateData.city = finalCity;

      if (finalState !== null && finalState !== undefined) updateData.state = finalState;
      else if (!cart.state && finalState) updateData.state = finalState;

      if (finalZip !== null && finalZip !== undefined) updateData.zip = finalZip;
      else if (!cart.zip && finalZip) updateData.zip = finalZip;

      if (finalCountry !== null && finalCountry !== undefined) updateData.country = finalCountry;
      else if (!cart.country && finalCountry) updateData.country = finalCountry;

      if (finalLat !== null && finalLat !== undefined) updateData.latitude = finalLat;
      if (finalLng !== null && finalLng !== undefined) updateData.longitude = finalLng;

      cart = await prisma.cart.update({
        where: { id: cart.id },
        data: updateData,
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
        const validItems = items.filter((item: any) => item && (item.productId || item.title || item.variantId || item.id));
        if (validItems.length > 0) {
          const result = await tx.cartItem.createMany({
            data: validItems.map((item: any) => ({
              cartId: cart.id,
              productId: item.productId ? String(item.productId) : String(item.id || item.variantId || Math.random()),
              variantId: item.variantId ? String(item.variantId) : null,
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

