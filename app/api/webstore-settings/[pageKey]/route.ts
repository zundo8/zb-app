import { NextResponse } from 'next/server';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/db';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

// GET: Fetch settings and last editor audit log for the given pageKey
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pageKey: string }> }
) {
  try {
    await requirePermission('STOREFRONT', 'view');
    const { pageKey } = await params;

    // Fetch store settings from DB
    let settings = await prisma.storeSettings.findUnique({
      where: { pageKey }
    });

    // If no row exists and pageKey is homepage, create seed defaults dynamically to avoid blank states
    if (!settings && pageKey === 'homepage') {
      settings = await prisma.storeSettings.create({
        data: {
          pageKey: 'homepage',
          homePageTitle: 'Zica Bella | Luxury Indian Streetwear for Modern Men',
          metaDescription: 'Zica Bella crafts luxury Indian streetwear for modern men, oversized heavyweight tees, acid-wash finishes, cargos and modern denim designed for bold everyday style.',
          twitterCardType: 'summary_large_image'
        }
      });
    }

    // If no row exists and pageKey is social_links, create seed defaults dynamically to avoid blank states
    if (!settings && pageKey === 'social_links') {
      settings = await prisma.storeSettings.create({
        data: {
          pageKey: 'social_links',
          metaDescription: JSON.stringify([
            { id: "instagram", platform: "instagram", label: "Instagram", url: "https://www.instagram.com/zica.bella", placements: ["footer", "mobile"] },
            { id: "apple", platform: "apple", label: "Apple Music", url: "https://music.apple.com", placements: ["footer", "mobile"] },
            { id: "spotify", platform: "spotify", label: "Spotify", url: "https://open.spotify.com", placements: ["footer", "mobile"] },
            { id: "youtube", platform: "youtube", label: "YouTube", url: "https://www.youtube.com/@Zicabella", placements: ["footer", "mobile"] }
          ])
        }
      });
    }

    // Get last editor details from the audit log
    const lastAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'UPDATE_STORE_SETTINGS',
        module: 'STOREFRONT',
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    const lastUpdatedBy = lastAudit?.user?.name || lastAudit?.user?.email || 'System';
    const lastUpdatedAt = lastAudit?.timestamp || settings?.updatedAt || new Date();

    return NextResponse.json({
      success: true,
      settings,
      lastUpdatedBy,
      lastUpdatedAt
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

// PUT: Update settings for the given pageKey
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pageKey: string }> }
) {
  try {
    await requirePermission('STOREFRONT', 'edit');
    const { pageKey } = await params;

    const body = await request.json();
    const {
      homePageTitle,
      metaDescription,
      socialImageUrl,
      socialImageAlt,
      twitterCardType
    } = body;

    // Server-side validation
    if (pageKey !== 'social_links') {
      if (homePageTitle && homePageTitle.length > 70) {
        return NextResponse.json({ error: 'Title cannot exceed 70 characters.' }, { status: 400 });
      }
      if (metaDescription && metaDescription.length > 320) {
        return NextResponse.json({ error: 'Meta description cannot exceed 320 characters.' }, { status: 400 });
      }
    }

    // Upsert settings row
    const settings = await prisma.storeSettings.upsert({
      where: { pageKey },
      update: {
        homePageTitle: homePageTitle || null,
        metaDescription: metaDescription || null,
        socialImageUrl: socialImageUrl || null,
        socialImageAlt: socialImageAlt || null,
        twitterCardType: twitterCardType || 'summary_large_image',
      },
      create: {
        pageKey,
        homePageTitle: homePageTitle || null,
        metaDescription: metaDescription || null,
        socialImageUrl: socialImageUrl || null,
        socialImageAlt: socialImageAlt || null,
        twitterCardType: twitterCardType || 'summary_large_image',
      }
    });

    // Write audit log entry
    await logAudit({
      action: 'UPDATE_STORE_SETTINGS',
      module: 'STOREFRONT',
      targetId: settings.id,
      metadata: {
        pageKey,
        title: homePageTitle,
        hasImage: !!socialImageUrl
      }
    });

    // Invalidate Next.js cache locally for this page settings
    const cacheTag = `store-settings-${pageKey}`;
    try {
      revalidateTag(cacheTag);
      console.log(`[Cache Revalidation] Triggered revalidateTag: ${cacheTag}`);
    } catch (e: any) {
      console.error(`[Cache Revalidation Failed]: ${e.message}`);
    }

    return NextResponse.json({
      success: true,
      settings
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
