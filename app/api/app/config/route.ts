import { NextResponse } from 'next/server';
import prisma, { getShopSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const shop = await getShopSettings();

    if (!shop) {
      return NextResponse.json({ error: 'Store configuration not found' }, { status: 404 });
    }

    // Parse JSON fields safely
    const safeJsonParse = (val: string | null | undefined, fallback: any = []) => {
      if (!val) return fallback;
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    };

    // Return null for empty strings so the RN app shows nothing when no value is set
    // This prevents hardcoded fallback text from appearing when admin clears a field
    const nullIfEmpty = (val: string | null | undefined): string | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'string' && val.trim() === '') return null;
      return val;
    };

    const s = shop as any;

    const config = {
      hero: {
        image: nullIfEmpty(s.heroImage),
        video: nullIfEmpty(s.heroVideo),
        title: s.heroTitle ?? null,        // preserve empty string "" as null (admin cleared it)
        subtitle: s.heroSubtitle ?? null,
        buttonText: s.heroButtonText ?? null,
        showText: s.showHeroText,
      },
      latestCuration: {
        title: s.latestCurationTitle ?? null,
        subtitle: s.latestCurationSubtitle ?? null,
        show: s.showLatestCuration,
      },
      archive: {
        title: s.archiveTitle ?? null,
        subtitle: s.archiveSubtitle ?? null,
        show: s.showArchive,
        video: nullIfEmpty(s.collectionsMedia),  // archive video = collectionsMedia field
      },
      blueprint: {
        title: s.blueprintTitle ?? null,
        subtitle: s.blueprintSubtitle ?? null,
        show: s.showBlueprint,
        image: nullIfEmpty(s.featuredMediaImage),
      },
      pdp: {
        showProductVideo: s.showProductVideo,
        showSizeChart: s.showSizeChart,
        showBrand: s.showBrand,
        showShippingReturn: s.showShippingReturn,
        showCare: s.showCare,
        showSizeFit: s.showSizeFit,
        showDetails: s.showDetails,
        background: nullIfEmpty(s.pdpBackground),
      },
      social: {
        instagram: nullIfEmpty(s.instagramUrl),
        apple: nullIfEmpty(s.appleUrl),
        spotify: nullIfEmpty(s.spotifyUrl),
        youtube: nullIfEmpty(s.youtubeUrl),
      },
      media: {
        featured: nullIfEmpty(s.featuredMedia),
        featuredImage: nullIfEmpty(s.featuredMediaImage),
        collections: nullIfEmpty(s.collectionsMedia),
        footer: nullIfEmpty(s.footerVideo),
        footerLogo3dUrl: s.footerLogo3dUrl || 'https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb',
      },
      navigation: {
        mainMenu: s.mainMenuHandle,
        secondaryMenu: s.secondaryMenuHandle,
        enabledCollectionsHeader: safeJsonParse(s.enabledCollectionsHeader),
        enabledCollectionsPage: safeJsonParse(s.enabledCollectionsPage),
        enabledCollectionsMenu: safeJsonParse(s.enabledCollectionsMenu),
      },
      features: {
        showTreeText: s.showTreeText,
        kineticMeshProducts: safeJsonParse(s.kineticMeshProducts),
        kineticMeshTitle: s.kineticMeshTitle ?? null,
      },
      community: {
        title: s.communityTitle ?? null,
        subtitle: s.communitySubtitle ?? null,
        show: s.showCommunity,
        ageRestricted: s.communityAgeRestricted,
        minOrders: s.communityMinOrders,
        whatsAppEnabled: s.communityWhatsAppEnabled,
      },
      spotlight: {
        title: s.spotlightTitle ?? null,
        subtitle: s.spotlightSubtitle ?? null,
        collection: s.spotlightCollection || null,
        products: safeJsonParse(s.spotlightProducts),
        media: s.spotlightMedia || null,
      },
      homepage: {
        collection: s.homepageCollection || null,
        products: s.homepageProducts || null,
      },
      flipbook: {
        config: safeJsonParse(s.flipbookConfig),
        desc: s.flipbookDesc ?? null,
        image: nullIfEmpty(s.flipbookImage),
        tag: s.flipbookTag ?? null,
        title: s.flipbookTitle ?? null,
        video: nullIfEmpty(s.flipbookVideo),
      },
      ringCarousel: {
        items: safeJsonParse(s.ringCarouselItems),
        title: s.ringCarouselTitle ?? null,
        show: s.showRingCarousel,
      }
    };

    return NextResponse.json({ config }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[App API] Config error:', error.message);
    return NextResponse.json(
      { config: null, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
