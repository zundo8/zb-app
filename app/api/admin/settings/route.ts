import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const ENV_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com';
const ENV_TOKEN  = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';

/** Build a settings response from env vars (used when DB is unavailable) */
function envSettings() {
  return {
    id: 'env-fallback',
    dbStatus: 'mock_failure',
    dbError: 'Database connection failed. Ensure POSTGRES_PRISMA_URL or DATABASE_URL is set in environment variables and redeploy.',
    shopDomain: ENV_DOMAIN,
    accessToken: ENV_TOKEN,
    delhiveryApiKey: '',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    shiprocketEmail: '',
    shiprocketToken: '',
    webhookSecret: '',
    whatsappPhoneId: '',
    whatsappToken: '',
    firebaseProjectId: '',
    firebaseClientEmail: '',
    firebasePrivateKey: '',
    sendgridApiKey: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    heroImage: '',
    heroVideo: '',
    heroTitle: '',
    heroSubtitle: '',
    heroButtonText: 'Discover',
    latestCurationTitle: 'Latest curation',
    latestCurationSubtitle: 'Season Drop',
    archiveTitle: 'The Archive',
    archiveSubtitle: 'Organic Evolution',
    blueprintTitle: 'The blueprint of Zica Bella',
    blueprintSubtitle: 'Technique & Motion',
    showProductVideo: true,
    showSizeChart: true,
    showBrand: true,
    showShippingReturn: true,
    showCare: true,
    showSizeFit: true,
    showDetails: true,
    pdpBackground: '',
    instagramUrl: '',
    appleUrl: '',
    spotifyUrl: '',
    youtubeUrl: '',
    showHeroText: false,
    showLatestCuration: true,
    showArchive: true,
    showBlueprint: true,
    featuredMedia: '',
    featuredMediaImage: '',
    collectionsMedia: '',
    footerVideo: '',
    mainMenuHandle: '',
    secondaryMenuHandle: '',
    showTreeText: true,
    showCommunity: true,
    communityTitle: 'Featured Looks',
    communitySubtitle: 'Community',
    spotlightTitle: 'AUTHENTIC STREETWEAR',
    spotlightSubtitle: 'Luxury Indian streetwear for modern men. Redefining bold everyday style.',
    spotlightCollection: 'tshirts',
    spotlightProducts: '',
    homepageCollection: '',
    homepageProducts: '',
    kineticMeshTitle: 'ARCHIVE EDITION',
    kineticMeshProducts: '',
    enabledCollectionsHeader: '[]',
    enabledCollectionsPage: '[]',
    enabledCollectionsMenu: '[]',
    flipbookConfig: '[]',
    flipbookImage: '',
    flipbookTitle: 'Archival Vision',
    flipbookTag: 'Core Manifest',
    flipbookDesc: 'Engineered for those who move without compromise.',
    communityMinOrders: 1,
    communityAgeRestricted: true,
    communityWhatsAppEnabled: true,
    footerLogo3dUrl: 'https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb',
  };
}

// GET: Fetch settings
export async function GET(req: Request) {
  try {
    const isMock = (prisma as any)._isMock;

    // If DB is not available, return env-based settings immediately
    if (isMock) {
      const mockReason = (prisma as any)._mockReason || 'unknown';
      const fallback = envSettings();
      fallback.dbError = `Database mock triggered. Reason: ${mockReason}. Please configure POSTGRES_PRISMA_URL or DATABASE_URL.`;
      return NextResponse.json(fallback);
    }

    const url = new URL(req.url);
    const domainOverride = url.searchParams.get('shop') || ENV_DOMAIN;

    let shop: any = null;

    try {
      shop = await prisma.shop.findFirst({
        where: domainOverride ? { domain: domainOverride } : {}
      });

      if (!shop) shop = await prisma.shop.findFirst();

      // Auto-create shop record from env vars if none exists
      if (!shop) {
        console.log('[Settings API] Auto-initializing shop record from env vars...');
        shop = await prisma.shop.create({
          data: {
            domain: ENV_DOMAIN,
            accessToken: ENV_TOKEN || 'shpat_required',
          }
        });
        console.log(`[Settings API] Shop record created: ${shop.domain}`);
      }
    } catch (dbErr: any) {
      console.error('[Settings API GET DB error]:', dbErr.message);
      // DB connected but query failed — return env settings with error info
      return NextResponse.json({ ...envSettings(), dbError: `DB error: ${dbErr.message}` });
    }

    const s = shop as any;
    return NextResponse.json({
      id: s.id,
      dbStatus: 'connected',
      shopDomain: s.domain || ENV_DOMAIN,
      accessToken: s.accessToken || ENV_TOKEN,
      delhiveryApiKey: s.delhiveryApiKey || '',
      razorpayKeyId: s.razorpayKeyId || '',
      razorpayKeySecret: s.razorpayKeySecret || '',
      shiprocketEmail: s.shiprocketEmail || '',
      shiprocketPassword: s.shiprocketPassword || '',
      shiprocketToken: s.shiprocketToken || '',
      webhookSecret: s.webhookSecret || '',
      whatsappPhoneId: s.whatsappPhoneId || '',
      whatsappToken: s.whatsappToken || '',
      firebaseProjectId: s.firebaseProjectId || '',
      firebaseClientEmail: s.firebaseClientEmail || '',
      firebasePrivateKey: s.firebasePrivateKey || '',
      sendgridApiKey: s.sendgridApiKey || '',
      twilioAccountSid: s.twilioAccountSid || '',
      twilioAuthToken: s.twilioAuthToken || '',
      twilioPhoneNumber: s.twilioPhoneNumber || '',
      heroImage: s.heroImage || '',
      heroVideo: s.heroVideo || '',
      heroTitle: s.heroTitle || '',
      heroSubtitle: s.heroSubtitle || '',
      heroButtonText: s.heroButtonText || 'Discover',
      latestCurationTitle: s.latestCurationTitle || 'Latest curation',
      latestCurationSubtitle: s.latestCurationSubtitle || 'Season Drop',
      archiveTitle: s.archiveTitle || 'The Archive',
      archiveSubtitle: s.archiveSubtitle || 'Organic Evolution',
      blueprintTitle: s.blueprintTitle || 'The blueprint of Zica Bella',
      blueprintSubtitle: s.blueprintSubtitle || 'Technique & Motion',
      showProductVideo: s.showProductVideo ?? true,
      showSizeChart: s.showSizeChart ?? true,
      showBrand: s.showBrand ?? true,
      showShippingReturn: s.showShippingReturn ?? true,
      showCare: s.showCare ?? true,
      showSizeFit: s.showSizeFit ?? true,
      showDetails: s.showDetails ?? true,
      pdpBackground: s.pdpBackground || '',
      instagramUrl: s.instagramUrl || '',
      appleUrl: s.appleUrl || '',
      spotifyUrl: s.spotifyUrl || '',
      youtubeUrl: s.youtubeUrl || '',
      showHeroText: s.showHeroText ?? true,
      showLatestCuration: s.showLatestCuration ?? true,
      showArchive: s.showArchive ?? true,
      showBlueprint: s.showBlueprint ?? true,
      featuredMedia: s.featuredMedia || '',
      featuredMediaImage: s.featuredMediaImage || '',
      collectionsMedia: s.collectionsMedia || '',
      footerVideo: s.footerVideo || '',
      mainMenuHandle: s.mainMenuHandle || '',
      secondaryMenuHandle: s.secondaryMenuHandle || '',
      showTreeText: s.showTreeText ?? true,
      showCommunity: s.showCommunity ?? true,
      communityTitle: s.communityTitle || 'Featured Looks',
      communitySubtitle: s.communitySubtitle || 'Community',
      spotlightTitle: s.spotlightTitle || 'AUTHENTIC STREETWEAR',
      spotlightSubtitle: s.spotlightSubtitle || 'Luxury Indian streetwear for modern men. Redefining bold everyday style.',
      spotlightCollection: s.spotlightCollection || 'tshirts',
      spotlightProducts: s.spotlightProducts || '',
      kineticMeshTitle: s.kineticMeshTitle || 'ARCHIVE EDITION',
      kineticMeshProducts: s.kineticMeshProducts || '',
      enabledCollectionsHeader: s.enabledCollectionsHeader || '[]',
      enabledCollectionsPage: s.enabledCollectionsPage || '[]',
      enabledCollectionsMenu: s.enabledCollectionsMenu || '[]',
      flipbookConfig: s.flipbookConfig || '[]',
      flipbookImage: s.flipbookImage || '',
      flipbookVideo: s.flipbookVideo || '',
      flipbookTitle: s.flipbookTitle || 'Archival Vision',
      flipbookTag: s.flipbookTag || 'Core Manifest',
      flipbookDesc: s.flipbookDesc || 'Engineered for those who move without compromise.',
      communityMinOrders: s.communityMinOrders ?? 1,
      communityAgeRestricted: s.communityAgeRestricted ?? true,
      communityWhatsAppEnabled: s.communityWhatsAppEnabled ?? true,
      ringCarouselTitle: s.ringCarouselTitle || 'RING COLLECTION',
      ringCarouselItems: s.ringCarouselItems || '[]',
      footerLogo3dUrl: s.footerLogo3dUrl || 'https://cdn.shopify.com/3d/models/faaab5221b0b704c/Zicabella-logo-new22.glb',
      homepageCollection: s.homepageCollection || '',
      homepageProducts: s.homepageProducts || '',
      claudeApiKey: s.claudeApiKey || '',
      claudeWebhookSecret: s.claudeWebhookSecret || '',
    });
  } catch (e: any) {
    console.error('[Settings API GET Error]:', e);
    return NextResponse.json({ ...envSettings(), dbError: e.message });
  }
}

// PATCH: Update settings
export async function PATCH(req: Request) {
  try {
    const isMock = (prisma as any)._isMock;
    if (isMock) {
      const mockReason = (prisma as any)._mockReason || 'unknown';
      return NextResponse.json({
        error: `Database is not connected (Reason: ${mockReason}). Cannot save settings. Ensure POSTGRES_PRISMA_URL or DATABASE_URL is set correctly in Vercel, then redeploy.`
      }, { status: 503 });
    }

    const body = await req.json();
    const { shopId, shopDomain: bodyDomain, ...updates } = body;

    const targetDomain = ENV_DOMAIN || bodyDomain;

    let shop: any = null;

    // 1. By ID
    if (shopId && shopId !== 'env-fallback') {
      shop = await prisma.shop.findUnique({ where: { id: shopId } }).catch(() => null);
    }

    // 2. By domain
    if (!shop && targetDomain) {
      shop = await prisma.shop.findFirst({ where: { domain: targetDomain } }).catch(() => null);
    }

    // 3. Any shop
    if (!shop) {
      shop = await prisma.shop.findFirst().catch(() => null);
    }

    // 4. Auto-create from env vars
    if (!shop) {
      console.log('[Settings API PATCH] No shop found, auto-creating from env vars...');
      shop = await prisma.shop.create({
        data: {
          domain: ENV_DOMAIN,
          accessToken: ENV_TOKEN || 'shpat_required',
        }
      });
    }

    if (!shop?.id) {
      return NextResponse.json({ error: 'Could not resolve shop record. Check database connection and try again.' }, { status: 500 });
    }

    const allowedKeys = [
      'domain', 'accessToken',
      'delhiveryApiKey', 'razorpayKeyId', 'razorpayKeySecret',
      'shiprocketEmail', 'shiprocketPassword', 'shiprocketToken', 'webhookSecret',
      'whatsappPhoneId', 'whatsappToken', 'firebaseProjectId', 'firebaseClientEmail',
      'firebasePrivateKey', 'sendgridApiKey', 'twilioAccountSid', 'twilioAuthToken', 'twilioPhoneNumber',
      'heroImage', 'heroVideo', 'heroTitle', 'heroSubtitle', 'heroButtonText',
      'latestCurationTitle', 'latestCurationSubtitle', 'archiveTitle', 'archiveSubtitle',
      'blueprintTitle', 'blueprintSubtitle', 'showHeroText', 'showLatestCuration',
      'showArchive', 'showBlueprint', 'showProductVideo', 'showSizeChart',
      'showBrand', 'showShippingReturn', 'showCare', 'showSizeFit', 'showDetails',
      'pdpBackground', 'instagramUrl', 'appleUrl', 'spotifyUrl', 'youtubeUrl',
      'featuredMedia', 'featuredMediaImage', 'collectionsMedia', 'kineticMeshProducts',
      'footerVideo', 'mainMenuHandle', 'secondaryMenuHandle', 'showTreeText',
      'showCommunity', 'communityTitle', 'communitySubtitle', 'spotlightTitle',
      'spotlightSubtitle', 'spotlightCollection', 'spotlightProducts', 'kineticMeshTitle', 'enabledCollectionsHeader',
      'enabledCollectionsPage', 'enabledCollectionsMenu', 'flipbookConfig',
      'flipbookImage', 'flipbookVideo', 'flipbookTitle', 'flipbookTag', 'flipbookDesc',
      'communityMinOrders', 'communityAgeRestricted', 'communityWhatsAppEnabled',
      'showRingCarousel', 'ringCarouselTitle', 'ringCarouselItems',
      'homepageCollection', 'homepageProducts',
      'footerLogo3dUrl', 'claudeApiKey', 'claudeWebhookSecret'
    ] as const;

    const booleanKeys = [
      'showHeroText', 'showLatestCuration', 'showArchive', 'showBlueprint',
      'showProductVideo', 'showSizeChart', 'showBrand', 'showShippingReturn',
      'showCare', 'showSizeFit', 'showDetails', 'showTreeText', 'showCommunity',
      'communityAgeRestricted', 'communityWhatsAppEnabled', 'showRingCarousel'
    ];

    const data: any = {};
    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        data[key] = booleanKeys.includes(key as any)
          ? (updates[key] === true || updates[key] === 'true')
          : updates[key];
      }
    }

    if (bodyDomain && !data.domain) data.domain = bodyDomain;

    // Data is already filtered by allowedKeys above — send directly to Prisma
    const updatedShop = await prisma.shop.update({
      where: { id: shop.id },
      data,
    });

    console.log(`[Settings API] Saved settings for ${updatedShop.domain}`);
    return NextResponse.json({ success: true, shopDomain: updatedShop.domain });
  } catch (e: any) {
    console.error('[Settings API PATCH Error]:', e);
    return NextResponse.json({ error: `Save failed: ${e.message}` }, { status: 500 });
  }
}
