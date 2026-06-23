import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * GET /api/storefront/banners
 * Public API — fetches active web store banners ordered by sortOrder.
 * No authentication required (public storefront).
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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
      return NextResponse.json([]);
    }
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/web_store_banners?select=id,title,subtitle,imageUrl:image_url,mobileImageUrl:mobile_image_url,ctaLabel:cta_label,ctaLink:cta_link,position&is_active=eq.true&order=position.asc`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: ['banners'] },
      }
    );

    if (!res.ok) {
      throw new Error(`REST fetch failed: ${res.statusText}`);
    }

    const banners = await res.json();
    return NextResponse.json(banners);
  } catch (error: any) {
    console.error("[Storefront Banners API] Supabase fetch failed, falling back to Prisma:", error.message);
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
    } catch {
      return NextResponse.json([]);
    }
  }
}
