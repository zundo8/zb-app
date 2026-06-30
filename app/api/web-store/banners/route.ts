import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

// GET: Fetch all banners (ordered by position)
export async function GET() {
  try {
    // Note: Banners GET is also used by the public storefront, so we do not enforce admin auth here.
    const banners = await prisma.webStoreBanner.findMany({
      orderBy: {
        position: "asc",
      },
    });

    return NextResponse.json({ banners });
  } catch (error: any) {
    console.error("[Web Store Banners GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// POST: Create a banner
export async function POST(request: Request) {
  try {
    await requirePermission('STOREFRONT', 'edit');

    const body = await request.json();
    const {
      title,
      subtitle,
      imageUrl,
      mobileImageUrl,
      ctaLabel,
      ctaLink,
      position,
      isActive
    } = body;

    if (!title || !imageUrl) {
      return NextResponse.json({ error: "Title and Image URL are required" }, { status: 400 });
    }

    // Resolve banner position dynamically if not explicitly specified
    let targetPosition = position;
    if (targetPosition === undefined || targetPosition === null) {
      const maxBanner = await prisma.webStoreBanner.findFirst({
        orderBy: {
          position: "desc",
        },
      });
      targetPosition = maxBanner ? maxBanner.position + 1 : 1;
    }

    const newBanner = await prisma.webStoreBanner.create({
      data: {
        title,
        subtitle: subtitle || null,
        imageUrl,
        mobileImageUrl: mobileImageUrl || null,
        ctaLabel: ctaLabel || null,
        ctaLink: ctaLink || null,
        position: targetPosition,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, banner: newBanner });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
