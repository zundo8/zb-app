import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { invalidateGlobalPricingCache } from "@/lib/global-pricing";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/global-store/countries
 * Fetch all configured countries.
 */
export async function GET() {
  try {
    const countries = await prisma.globalStoreCountry.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(countries);
  } catch (error: any) {
    console.error("[Admin Global Store Countries GET] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/global-store/countries
 * Batch update country configurations (multipliers, exchange rates, active state).
 */
export async function PUT(req: Request) {
  try {
    const { countries } = await req.json();

    if (!Array.isArray(countries)) {
      return NextResponse.json({ error: "Invalid countries payload" }, { status: 400 });
    }

    const updates = countries.map((c: any) =>
      prisma.globalStoreCountry.update({
        where: { id: c.id },
        data: {
          multiplier: Number(c.multiplier),
          exchangeRate: Number(c.exchangeRate),
          isActive: Boolean(c.isActive),
          sortOrder: Number(c.sortOrder ?? 0),
        },
      })
    );

    await prisma.$transaction(updates);

    // Cache-bust in-memory pricing cache on save
    invalidateGlobalPricingCache();

    const updatedCountries = await prisma.globalStoreCountry.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(updatedCountries);
  } catch (error: any) {
    console.error("[Admin Global Store Countries PUT] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
