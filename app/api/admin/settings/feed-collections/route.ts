/**
 * API: Manage feed-excluded collections
 *
 * GET  /api/admin/settings/feed-collections → { excludedCollections: string[] }
 * PATCH /api/admin/settings/feed-collections → body: { excludedCollections: string[] }
 *
 * Protected by middleware (/api/admin/:path* requires admin auth).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const shop = await prisma.shop.findFirst({
      select: { feedExcludedCollections: true },
    });

    let excludedCollections: string[] = [];
    if (shop?.feedExcludedCollections) {
      try {
        excludedCollections = JSON.parse(shop.feedExcludedCollections);
      } catch {
        excludedCollections = [];
      }
    }

    return NextResponse.json({ excludedCollections });
  } catch (err: any) {
    console.error('[Feed Collections API] GET Error:', err);
    return NextResponse.json({ excludedCollections: [] }, { status: 200 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { excludedCollections } = body;

    if (!Array.isArray(excludedCollections)) {
      return NextResponse.json(
        { error: 'excludedCollections must be an array of collection handle strings' },
        { status: 400 }
      );
    }

    // Normalise handles
    const normalised = excludedCollections
      .filter((h: any) => typeof h === 'string' && h.trim())
      .map((h: string) => h.trim().toLowerCase());

    const shop = await prisma.shop.findFirst({ select: { id: true } });
    if (!shop) {
      return NextResponse.json({ error: 'No shop found' }, { status: 500 });
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: { feedExcludedCollections: JSON.stringify(normalised) },
    });

    return NextResponse.json({
      success: true,
      excludedCollections: normalised,
    });
  } catch (err: any) {
    console.error('[Feed Collections API] PATCH Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
