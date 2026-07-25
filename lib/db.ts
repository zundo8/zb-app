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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[DB] Critical database configuration error: SUPABASE_DATABASE_URL / DATABASE_URL is missing or invalid in production!');
    }
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
      connectionTimeoutMillis: 5000, // Reduced from 10000 to prevent blocking readiness probes
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });

    const adapter = new PrismaPg(pool as any);

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    const extendedClient = client.$extends({
      query: {
        customer: {
          async create({ args, query }) {
            const customer = await query(args);
            try {
              if (customer) {
                import('./services/eventTracker').then(({ eventTracker }) => {
                  eventTracker.track({
                    eventName: 'Lead Created',
                    customerId: customer.id,
                    customerPhone: customer.phone,
                    eventSource: 'web',
                    metadata: { source: 'db_hook_signup' }
                  });
                  eventTracker.track({
                    eventName: 'User Registered',
                    customerId: customer.id,
                    customerPhone: customer.phone,
                    eventSource: 'web',
                    metadata: { source: 'db_hook_signup' }
                  });
                }).catch(() => {});
              }
            } catch (err) {
              console.error('[DB Middleware Error]:', err);
            }
            return customer;
          }
        },
        appLogin: {
          async create({ args, query }) {
            const appLogin = await query(args);
            try {
              if (appLogin && (appLogin.status === 'SUCCESS' || appLogin.status === 'ACCOUNT_CREATED')) {
                import('./services/eventTracker').then(async ({ eventTracker }) => {
                  const cleanPhone = appLogin.phone ? appLogin.phone.replace(/\D/g, "") : "";
                  const last10 = cleanPhone.slice(-10);
                  let customerId = null;
                  if (last10) {
                    const customer = await client.customer.findFirst({
                      where: { phone: { contains: last10 } }
                    });
                    customerId = customer?.id || null;
                  }
                  eventTracker.track({
                    eventName: 'User Login',
                    customerId,
                    customerPhone: appLogin.phone,
                    eventSource: 'web',
                    metadata: { userAgent: appLogin.userAgent, status: appLogin.status }
                  });
                }).catch(() => {});
              }
            } catch (err) {
              console.error('[DB Middleware Error]:', err);
            }
            return appLogin;
          }
        }
      }
    });

    console.log('[DB] Prisma Client initialized with PgAdapter (SSL Patch v1.0.3 active)');
    return extendedClient as any;
  } catch (error: any) {
    console.error('[DB] Critical Prisma initialization error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[DB] Critical Prisma initialization error in production: ${error.message}`);
    }
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

export const DEFAULT_SHOP_SETTINGS = {
  id: 'env-fallback',
  domain: process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com',
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
  heroTitle: "Redefine The Standard",
  heroSubtitle: "Atmospheric luxury streetwear",
  heroButtonText: "Discover",
  latestCurationTitle: "Latest curation",
  latestCurationSubtitle: "Season Drop",
  archiveTitle: "The Archive",
  archiveSubtitle: "Organic Evolution",
  blueprintTitle: "The blueprint of Zica Bella",
  blueprintSubtitle: "Technique & Motion",
  showHeroText: true,
  showLatestCuration: true,
  showArchive: true,
  showBlueprint: true,
  showCommunity: true,
  communityTitle: "Featured Looks",
  communitySubtitle: "Community",
  spotlightTitle: "AUTHENTIC STREETWEAR",
  spotlightSubtitle: "Luxury Indian streetwear for modern men. Redefining bold everyday style.",
  spotlightCollection: "tshirts",
  shopAllLink: "/collections/all",
  footerLogo3dUrl: "https://cdn.shopify.com/3d/models/e024b09e83a75c03/Zicabella-silver-logo.glb",
  showProductVideo: true,
  showSizeChart: true,
  showBrand: true,
  showShippingReturn: true,
  showCare: true,
  showSizeFit: true,
  showDetails: true,
  showTreeText: true,
  communityMinOrders: 1,
  communityAgeRestricted: true,
  communityWhatsAppEnabled: true,
  showRingCarousel: true,
  ringCarouselTitle: "RING COLLECTION",
  flipbookTitle: "Archival Vision",
  flipbookTag: "Core Manifest",
  flipbookDesc: "Engineered for those who move without compromise.",
};

export async function getShopSettings() {
  try {
    const shop = await prisma.shop.findUnique({ where: { domain: '8tiahf-bk.myshopify.com' } })
      ?? await prisma.shop.findFirst();
    return shop ?? DEFAULT_SHOP_SETTINGS;
  } catch (error: any) {
    console.error('[DB] getShopSettings direct query failed:', error.message);
    return DEFAULT_SHOP_SETTINGS;
  }
}

export async function getStoreSettings(pageKey: string) {
  try {
    return await prisma.storeSettings.findUnique({ where: { pageKey } });
  } catch (error: any) {
    console.error(`[DB] getStoreSettings direct query failed for ${pageKey}:`, error.message);
    return null;
  }
}




