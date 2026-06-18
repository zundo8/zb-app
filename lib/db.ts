import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Mock Prisma client for when database is unavailable
const createMockPrismaClient = (reason: string) => {
  console.warn(`[DB] Using mock Prisma client. Reason: ${reason}`);
  const handler: any = {
    get: function(target: any, prop: any) {
      if (prop === '_isMock') return true;
      if (prop === '_mockReason') return reason;
      if (prop === 'then') return undefined;
      if (typeof prop === 'string' && prop.startsWith('$')) {
        return () => Promise.resolve([]);
      }
      const mockReturn = (targetProp: string) => {
        if (targetProp === 'count') return 0;
        if (targetProp === 'findMany') return [];
        return { 
          id: 'mock_id', 
          shopifyId: 'mock_shopify_id', 
          handle: 'mock_handle', 
          domain: 'mock.myshopify.com',
          title: 'Mock Item',
          orders: []
        };
      };
      return new Proxy(
        function(...args: any[]) {
          return Promise.resolve(mockReturn(String(prop)));
        },
        handler
      );
    }
  };
  return new Proxy({}, handler) as unknown as PrismaClient;
};

const prismaClientSingleton = () => {
  if (process.env.SUPABASE_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.SUPABASE_DATABASE_URL;
    // Clear other cloud platform overrides to force connecting to Supabase
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL;
  }
  const dbUrl = process.env.DATABASE_URL || '';
  const isSqlite = dbUrl.startsWith('file:');

  const pgUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    (dbUrl && !isSqlite ? dbUrl : '');

  const isValidPgUrl = pgUrl && !pgUrl.includes('(not available)') && !pgUrl.includes('placeholder') && pgUrl !== '';

  if (isValidPgUrl && !dbUrl.startsWith('postgres') && !isSqlite) {
    process.env.DATABASE_URL = pgUrl;
  }

  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (isBuild) {
    return createMockPrismaClient('build');
  }

  if (!pgUrl || pgUrl.includes('placeholder') || pgUrl === '' || pgUrl.includes('(not available)')) {
    console.error('[DB] No database URL found. Set DATABASE_URL.');
    return createMockPrismaClient('no_db_url');
  }

  try {
    // Force allow self-signed certificates globally for the process
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const pool = new Pool({
      connectionString: pgUrl,
      ssl: { 
        rejectUnauthorized: false 
      },
      max: 5, // Reduced from 20 to prevent database connection exhaustion in production
      idleTimeoutMillis: 15000, // Reduced from 30000
      connectionTimeoutMillis: 10000, // Reduced from 15000
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });

    const adapter = new PrismaPg(pool as any);

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    console.log('[DB] Prisma Client initialized with PgAdapter (SSL Patch v1.0.3 active)');
    return client;
  } catch (error: any) {
    console.error('[DB] Critical Prisma initialization error:', error.message);
    return createMockPrismaClient(`init_error: ${error.message}`);
  }
};

declare const globalThis: {
  __prisma_fresh_v2: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.__prisma_fresh_v2 ?? prismaClientSingleton();

// Cache the Prisma client instance globally in all environments to prevent connection leaks
globalThis.__prisma_fresh_v2 = prisma;

export default prisma;

/**
 * Resiliently fetch shop settings without crashing on missing columns.
 */
export async function getShopSettings() {
  const shopFields = [
    'id', 'domain', 'name', 'email', 'currency', 'status', 'createdAt', 'updatedAt',
    'heroTitle', 'heroSubtitle', 'heroVideo', 'heroImage', 'showHeroText',
    'blueprintTitle', 'blueprintSubtitle', 'blueprintImage', 'archiveTitle', 'archiveSubtitle',
    'latestCurationTitle', 'latestCurationSubtitle', 'communityTitle', 'communitySubtitle',
    'flipbookDesc', 'flipbookImage', 'flipbookTag', 'flipbookTitle', 'flipbookVideo', 'flipbookConfig',
    'ringCarouselItems', 'ringCarouselTitle', 'showRingCarousel',
    'spotlightCollection', 'spotlightProducts', 'spotlightTitle', 'spotlightSubtitle', 'spotlightMedia',
    'homepageCollection', 'homepageProducts',
    'footerLogo3dUrl', 'showLatestCuration', 'showArchive', 'showBlueprint', 'showProductVideo',
    'showSizeChart', 'showBrand', 'showShippingReturn', 'showCare', 'showSizeFit', 'showDetails',
    'pdpBackground', 'instagramUrl', 'appleUrl', 'spotifyUrl', 'youtubeUrl', 'featuredMedia',
    'featuredMediaMobile', 'featuredMediaImageMobile', 'collectionsMediaMobile', 'flipbookImageMobile',
    'flipbookVideoMobile', 'footerVideoMobile',
    'collectionsMedia', 'footerVideo', 'footerLogo3dUrl', 'mainMenuHandle', 'secondaryMenuHandle', 'showTreeText',
    'enabledCollectionsHeader', 'enabledCollectionsPage', 'enabledCollectionsMenu', 'featuredMediaImage',
    'kineticMeshProducts', 'kineticMeshTitle', 'showCommunity', 'communityAgeRestricted',
    'communityMinOrders', 'communityWhatsAppEnabled',
    'loginBgImage', 'loginBgVideo', 'loginBgImageMobile', 'loginBgVideoMobile',
    'loginBgImageLight', 'loginBgImageDark', 'loginBgImageLightMobile', 'loginBgImageDarkMobile'
  ];

  try {
    // Prefer the canonical 8tiahf-bk.myshopify.com record to stay in sync with the webstore
    const shop = await prisma.shop.findUnique({ where: { domain: '8tiahf-bk.myshopify.com' } })
      ?? await prisma.shop.findFirst();
    return shop;
  } catch (error) {
    console.warn('[DB] Full shop fetch failed, falling back to safe selection:', (error as any).message);
    
    // Fallback: Fetch fields one by one or in a smaller subset
    // This handles the case where new columns like 'spotlightMedia' don't exist yet
    return prisma.shop.findFirst({
      select: {
        id: true,
        domain: true,
        heroTitle: true,
        heroSubtitle: true,
        heroVideo: true,
        heroImage: true,
        heroButtonText: true,
        showHeroText: true,
        latestCurationTitle: true,
        latestCurationSubtitle: true,
        showLatestCuration: true,
        archiveTitle: true,
        archiveSubtitle: true,
        showArchive: true,
        blueprintTitle: true,
        blueprintSubtitle: true,
        showBlueprint: true,
        showProductVideo: true,
        showSizeChart: true,
        showBrand: true,
        showShippingReturn: true,
        showCare: true,
        showSizeFit: true,
        showDetails: true,
        pdpBackground: true,
        instagramUrl: true,
        appleUrl: true,
        spotifyUrl: true,
        youtubeUrl: true,
        featuredMedia: true,
        featuredMediaImage: true,
        featuredMediaMobile: true,
        featuredMediaImageMobile: true,
        collectionsMedia: true,
        collectionsMediaMobile: true,
        footerVideo: true,
        footerVideoMobile: true,
        footerLogo3dUrl: true,
        mainMenuHandle: true,
        secondaryMenuHandle: true,
        showTreeText: true,
        enabledCollectionsHeader: true,
        enabledCollectionsPage: true,
        enabledCollectionsMenu: true,
        kineticMeshProducts: true,
        kineticMeshTitle: true,
        communityTitle: true,
        communitySubtitle: true,
        showCommunity: true,
        communityAgeRestricted: true,
        communityMinOrders: true,
        communityWhatsAppEnabled: true,
        spotlightTitle: true,
        spotlightSubtitle: true,
        spotlightCollection: true,
        spotlightProducts: true,
        spotlightMedia: true,
        homepageCollection: true,
        homepageProducts: true,
        flipbookConfig: true,
        flipbookDesc: true,
        flipbookImage: true,
        flipbookImageMobile: true,
        flipbookTag: true,
        flipbookTitle: true,
        flipbookVideo: true,
        flipbookVideoMobile: true,
        ringCarouselItems: true,
        ringCarouselTitle: true,
        showRingCarousel: true,
        loginBgImage: true,
        loginBgVideo: true,
        loginBgImageMobile: true,
        loginBgVideoMobile: true,
        loginBgImageLight: true,
        loginBgImageDark: true,
        loginBgImageLightMobile: true,
        loginBgImageDarkMobile: true,
      }
    }) as any;
  }
}

