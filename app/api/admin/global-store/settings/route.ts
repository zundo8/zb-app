import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { invalidateGlobalPricingCache } from "@/lib/global-pricing";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/global-store/settings
 * Fetch global store settings (feature toggle).
 */
export async function GET() {
  try {
    let settings = await prisma.globalStoreSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.globalStoreSettings.create({
        data: { id: "singleton", globalStoreEnabled: false },
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("[Admin Global Store Settings GET] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/global-store/settings
 * Update global store settings (enable/disable multi-country storefront).
 */
export async function PUT(req: Request) {
  try {
    const { globalStoreEnabled } = await req.json();

    const settings = await prisma.globalStoreSettings.upsert({
      where: { id: "singleton" },
      update: { globalStoreEnabled: Boolean(globalStoreEnabled) },
      create: { id: "singleton", globalStoreEnabled: Boolean(globalStoreEnabled) },
    });

    // Cache-bust in-memory cache on save
    invalidateGlobalPricingCache();

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("[Admin Global Store Settings PUT] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
