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

    const config = {
      hero: {
        image: shop.heroImage,
        video: shop.heroVideo,
        title: shop.heroTitle,
        subtitle: shop.heroSubtitle,
        buttonText: shop.heroButtonText,
        showText: shop.showHeroText,
      },
      latestCuration: {
        title: shop.latestCurationTitle,
        subtitle: shop.latestCurationSubtitle,
        show: shop.showLatestCuration,
      },
      archive: {
        title: shop.archiveTitle,
        subtitle: shop.archiveSubtitle,
        show: shop.showArchive,
      },
      blueprint: {
        title: shop.blueprintTitle,
        subtitle: shop.blueprintSubtitle,
        show: shop.showBlueprint,
        image: shop.featuredMediaImage,
      },
      pdp: {
        showProductVideo: shop.showProductVideo,
        showSizeChart: shop.showSizeChart,
        showBrand: shop.showBrand,
        showShippingReturn: shop.showShippingReturn,
        showCare: shop.showCare,
        showSizeFit: shop.showSizeFit,
        showDetails: shop.showDetails,
        background: shop.pdpBackground,
      },
      social: {
        instagram: shop.instagramUrl,
        apple: shop.appleUrl,
        spotify: shop.spotifyUrl,
        youtube: shop.youtubeUrl,
      },
      media: {
        featured: shop.featuredMedia,
        featuredImage: shop.featuredMediaImage,
        collections: shop.collectionsMedia,
        footer: shop.footerVideo,
        footerLogo3dUrl: shop.footerLogo3dUrl || 'https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb',
      },
      navigation: {
        mainMenu: shop.mainMenuHandle,
        secondaryMenu: shop.secondaryMenuHandle,
        enabledCollectionsHeader: safeJsonParse(shop.enabledCollectionsHeader),
        enabledCollectionsPage: safeJsonParse(shop.enabledCollectionsPage),
        enabledCollectionsMenu: safeJsonParse(shop.enabledCollectionsMenu),
      },
      features: {
        showTreeText: shop.showTreeText,
        kineticMeshProducts: safeJsonParse(shop.kineticMeshProducts),
        kineticMeshTitle: shop.kineticMeshTitle,
      },
      community: {
        title: shop.communityTitle,
        subtitle: shop.communitySubtitle,
        show: shop.showCommunity,
        ageRestricted: shop.communityAgeRestricted,
        minOrders: shop.communityMinOrders,
        whatsAppEnabled: shop.communityWhatsAppEnabled,
      },
      spotlight: {
        title: shop.spotlightTitle,
        subtitle: shop.spotlightSubtitle,
        collection: shop.spotlightCollection,
        products: safeJsonParse(shop.spotlightProducts),
        media: (shop as any).spotlightMedia || null,
      },
      homepage: {
        collection: shop.homepageCollection,
        products: shop.homepageProducts,
      },
      flipbook: {
        config: safeJsonParse(shop.flipbookConfig),
        desc: shop.flipbookDesc,
        image: shop.flipbookImage,
        tag: shop.flipbookTag,
        title: shop.flipbookTitle,
        video: shop.flipbookVideo,
      },
      ringCarousel: {
        items: safeJsonParse(shop.ringCarouselItems),
        title: shop.ringCarouselTitle,
        show: shop.showRingCarousel,
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
