import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'

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
  const pgUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')
      ? process.env.DATABASE_URL
      : undefined);

  if (pgUrl && !process.env.DATABASE_URL?.startsWith('postgres')) {
    process.env.DATABASE_URL = pgUrl;
  }

  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (isBuild) {
    return createMockPrismaClient('build');
  }

  if (!pgUrl || pgUrl.includes('placeholder') || pgUrl === '') {
    console.error('[DB] No Postgres URL found. Set POSTGRES_URL or DATABASE_URL (postgres://…).');
    return createMockPrismaClient('no_postgres_url');
  }

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const pool = new Pool({
      connectionString: pgUrl,
      ssl: { rejectUnauthorized: false },
    });
    const adapter = new PrismaPg(pool);

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

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

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma_fresh_v2 = prisma;
}
