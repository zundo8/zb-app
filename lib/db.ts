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

export async function getShopSettings() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[DB] Supabase config not found for getShopSettings. Falling back to Prisma.');
    try {
      return await prisma.shop.findUnique({ where: { domain: '8tiahf-bk.myshopify.com' } })
        ?? await prisma.shop.findFirst();
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/Shop?domain=eq.8tiahf-bk.myshopify.com&select=*`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: ['homepage'] },
      }
    );

    if (!res.ok) {
      throw new Error(`Supabase REST fetch failed: ${res.statusText}`);
    }

    const data = await res.json();
    let shop = data?.[0] || null;

    if (!shop) {
      // Fallback to fetch first shop record if domain match not found
      const fallbackRes = await fetch(
        `${supabaseUrl}/rest/v1/Shop?select=*&limit=1`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          next: { revalidate: 300, tags: ['homepage'] },
        }
      );
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        shop = fallbackData?.[0] || null;
      }
    }

    return shop;
  } catch (error: any) {
    console.warn('[DB] Supabase REST fetch failed for getShopSettings, falling back to Prisma:', error.message);
    try {
      return await prisma.shop.findUnique({ where: { domain: '8tiahf-bk.myshopify.com' } })
        ?? await prisma.shop.findFirst();
    } catch {
      return null;
    }
  }
}

export async function getStoreSettings(pageKey: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(`[DB] Supabase config not found for getStoreSettings(${pageKey}). Falling back to Prisma.`);
    try {
      return await prisma.storeSettings.findUnique({ where: { pageKey } });
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/store_settings?page_key=eq.${pageKey}&select=*`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: [`store-settings-${pageKey}`] },
      }
    );

    if (!res.ok) {
      throw new Error(`Supabase REST fetch failed: ${res.statusText}`);
    }

    const data = await res.json();
    const settings = data?.[0] || null;

    // Map snake_case columns from REST API to camelCase schema matching Prisma output for consistent typings
    if (settings) {
      return {
        id: settings.id,
        pageKey: settings.page_key,
        homePageTitle: settings.home_page_title,
        metaDescription: settings.meta_description,
        socialImageUrl: settings.social_image_url,
        socialImageAlt: settings.social_image_alt,
        twitterCardType: settings.twitter_card_type,
        updatedBy: settings.updated_by,
        updatedAt: settings.updated_at,
        createdAt: settings.created_at,
      };
    }
    return null;
  } catch (error: any) {
    console.warn(`[DB] Supabase REST fetch failed for getStoreSettings(${pageKey}), falling back to Prisma:`, error.message);
    try {
      return await prisma.storeSettings.findUnique({ where: { pageKey } });
    } catch {
      return null;
    }
  }
}


