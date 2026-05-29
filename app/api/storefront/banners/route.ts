import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * GET /api/storefront/banners
 * Public API — fetches active web store banners ordered by sortOrder.
 * No authentication required (public storefront).
 */
export async function GET() {
  try {
    const banners = await prisma.webStoreBanner.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        mobileImageUrl: true,
        ctaLabel: true,
        ctaLink: true,
        position: true,
      },
    });

    return NextResponse.json(banners);
  } catch (error: any) {
    console.error("[Storefront Banners API] Error:", error.message);
    // Return empty array on error so storefront doesn't break
    return NextResponse.json([]);
  }
}
