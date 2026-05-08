import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const shop = await prisma.shop.findFirst({
      select: {
        // Hero section
        heroImage: true,
        heroVideo: true,
        heroTitle: true,
        heroSubtitle: true,
        heroButtonText: true,
        showHeroText: true,
        // Latest curation
        latestCurationTitle: true,
        latestCurationSubtitle: true,
        showLatestCuration: true,
        // Archive
        archiveTitle: true,
        archiveSubtitle: true,
        showArchive: true,
        // Blueprint
        blueprintTitle: true,
        blueprintSubtitle: true,
        showBlueprint: true,
        // PDP settings
        showProductVideo: true,
        showSizeChart: true,
        showBrand: true,
        showShippingReturn: true,
        showCare: true,
        showSizeFit: true,
        showDetails: true,
        pdpBackground: true,
        // Social
        instagramUrl: true,
        appleUrl: true,
        spotifyUrl: true,
        youtubeUrl: true,
        // Media
        featuredMedia: true,
        featuredMediaImage: true,
        collectionsMedia: true,
        footerVideo: true,
        footerLogo3dUrl: true,
        // Navigation
        mainMenuHandle: true,
        secondaryMenuHandle: true,
        enabledCollectionsHeader: true,
        enabledCollectionsPage: true,
        enabledCollectionsMenu: true,
        // Features
        showTreeText: true,
        kineticMeshProducts: true,
        kineticMeshTitle: true,
        // Community
        communitySubtitle: true,
        communityTitle: true,
        showCommunity: true,
        communityAgeRestricted: true,
        communityMinOrders: true,
        communityWhatsAppEnabled: true,
        // Spotlight
        spotlightSubtitle: true,
        spotlightTitle: true,
        spotlightCollection: true,
        spotlightProducts: true,
        // Flipbook
        flipbookConfig: true,
        flipbookDesc: true,
        flipbookImage: true,
        flipbookTag: true,
        flipbookTitle: true,
        flipbookVideo: true,
        // Ring Carousel
        ringCarouselItems: true,
        ringCarouselTitle: true,
        showRingCarousel: true,
      },
    });

    if (!shop) {
      return NextResponse.json(
        { config: null, error: 'No shop configuration found' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
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
      },
      flipbook: {
        config: safeJsonParse(shop.flipbookConfig),
        description: shop.flipbookDesc,
        image: shop.flipbookImage,
        tag: shop.flipbookTag,
        title: shop.flipbookTitle,
        video: shop.flipbookVideo,
      },
      ringCarousel: {
        items: safeJsonParse(shop.ringCarouselItems),
        title: shop.ringCarouselTitle,
        show: shop.showRingCarousel,
      },
    };

    return NextResponse.json({ config }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=120',
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
