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
  // URL resolution priority:
  // 1. SUPABASE_DATABASE_URL (explicitly set for Supabase pooler)
  // 2. POSTGRES_PRISMA_URL (Vercel-style, typically transaction pooler)
  // 3. POSTGRES_URL (Vercel-style)
  // 4. DATABASE_URL (fallback)
  
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
  if (supabaseUrl) {
    process.env.DATABASE_URL = supabaseUrl;
    // Clear other cloud platform overrides to force connecting to Supabase
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL;
  }
  const dbUrl = process.env.DATABASE_URL || '';
  const isSqlite = dbUrl.startsWith('file:');

  const pgUrl =
    supabaseUrl ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    (dbUrl && !isSqlite ? dbUrl : '');

  const isValidPgUrl = pgUrl && !pgUrl.includes('(not available)') && !pgUrl.includes('placeholder') && pgUrl !== '';

  if (isValidPgUrl && !dbUrl.startsWith('postgres') && !isSqlite) {
    process.env.DATABASE_URL = pgUrl;
  }

  // Always sync DATABASE_URL with what the pool will actually use
  if (isValidPgUrl && pgUrl !== dbUrl) {
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

  // Log which URL we're connecting to (redact password)
  const safeUrl = pgUrl.replace(/:([^@:]+)@/, ':****@');
  console.log(`[DB] Connecting via: ${safeUrl}`);

  try {
    // Force allow self-signed certificates globally for the process
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    // Connection Pool Configuration:
    // Increased max connections from 5 to 10 after Phase 1-3 query bounding & polling optimizations.
    // This allows higher concurrency for storefront checkout/product requests alongside admin dashboard usage
    // while staying safely within Supabase's transaction pooler (port 6543, Supavisor) client limits.
    const pool = new Pool({
      connectionString: pgUrl,
      ssl: { 
        rejectUnauthorized: false 
      },
      max: 10,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 10000, // Allows circuit breaker recovery under transient network pressure
    });

    pool.on('error', (err) => {
      const msg = String(err?.message || '');
      if (msg.includes('ECIRCUITBREAKER')) {
        console.error('[DB] Pool: ECIRCUITBREAKER — Supabase has temporarily blocked connections. Will auto-recover when breaker resets.');
      } else {
        console.error('[DB] Unexpected error on idle client:', msg);
      }
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

import * as fs from 'fs';
import * as path from 'path';

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), 'data/store-settings.json');

export function getPersistentSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const fileData = fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return { ...DEFAULT_SHOP_SETTINGS, ...parsed };
      }
    }
  } catch (e: any) {
    console.warn('[DB] Failed to read store-settings.json:', e.message);
  }
  return DEFAULT_SHOP_SETTINGS;
}

export function savePersistentSettings(updatedData: Record<string, any>) {
  try {
    const current = getPersistentSettings();
    const merged = { ...current, ...updatedData };
    delete merged.accessToken;
    const dataDir = path.dirname(SETTINGS_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    console.log('[DB] Successfully persisted shop settings to store-settings.json');
    return merged;
  } catch (e: any) {
    console.error('[DB] Failed to save store-settings.json:', e.message);
    return updatedData;
  }
}

export async function getShopSettings() {
  try {
    const isMock = (prisma as any)._isMock;
    if (isMock) {
      return getPersistentSettings();
    }
    const shop = await prisma.shop.findUnique({ where: { domain: '8tiahf-bk.myshopify.com' } })
      ?? await prisma.shop.findFirst();
    if (shop) {
      const persistent = getPersistentSettings();
      return { ...DEFAULT_SHOP_SETTINGS, ...persistent, ...shop };
    }
    return getPersistentSettings();
  } catch (error: any) {
    console.error('[DB] getShopSettings query failed, using persistent fallback:', error.message);
    return getPersistentSettings();
  }
}

export async function updateShopSettings(updates: Record<string, any>) {
  // Always update persistent JSON file to prevent desync during DB timeouts/redeployments
  const updatedPersistent = savePersistentSettings(updates);

  try {
    const isMock = (prisma as any)._isMock;
    if (isMock) {
      console.warn('[DB] Prisma is in mock mode; saved updates to persistent store-settings.json.');
      return updatedPersistent;
    }

    let shop = await prisma.shop.findUnique({ where: { domain: '8tiahf-bk.myshopify.com' } })
      ?? await prisma.shop.findFirst();

    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          domain: '8tiahf-bk.myshopify.com',
          accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || 'shpat_required',
          ...updates
        }
      });
    } else {
      shop = await prisma.shop.update({
        where: { id: shop.id },
        data: updates
      });
    }

    // Sync other shop records if multiple exist
    try {
      const syncData = { ...updates };
      delete syncData.domain;
      delete syncData.accessToken;
      await prisma.shop.updateMany({
        where: { id: { not: shop.id } },
        data: syncData
      });
    } catch {}

    return { ...DEFAULT_SHOP_SETTINGS, ...updatedPersistent, ...shop };
  } catch (error: any) {
    console.error('[DB] updateShopSettings DB update failed, falling back to persistent file:', error.message);
    return updatedPersistent;
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





