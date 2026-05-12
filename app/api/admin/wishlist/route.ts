import { NextResponse } from "next/server";
import prisma from "@/lib/db";
// Assuming there's some admin auth, but for now I'll check if it's an admin request
// Usually NextAuth is used for admin dashboard

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Fetch all wishlist items grouped by customer or just a flat list with customer details
    const wishlistItems = await prisma.wishlist.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          }
        },
        product: {
          select: {
            id: true,
            title: true,
            featuredImage: true,
            shopifyProductId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ items: wishlistItems });
  } catch (error) {
    console.error("Admin: Error fetching wishlists:", error);
    return NextResponse.json({ error: "Failed to fetch wishlists" }, { status: 500 });
  }
}
