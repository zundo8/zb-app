import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbUrl =
      process.env.SUPABASE_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL;

    const isBuild =
      process.env.npm_lifecycle_event === 'build' ||
      process.env.NEXT_PHASE === 'phase-production-build';
    const isProdWithoutDb =
      process.env.NODE_ENV === 'production' &&
      (!dbUrl || dbUrl.includes('placeholder'));

    // Bypass Prisma extensions entirely — use a raw pg.Pool query
    // so this endpoint always reports the TRUE connection state.
    let connectionAlive = false;
    let error: string | null = null;
    let shopCount = 0;
    let isCircuitBreakerBlocked = false;

    if (dbUrl && !dbUrl.includes('placeholder') && dbUrl !== '' && !dbUrl.includes('(not available)')) {
      let pool: Pool | null = null;
      try {
        pool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
          max: 1,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 5000,
        });

        const result = await pool.query('SELECT COUNT(*)::int AS count FROM "Shop"');
        shopCount = result.rows[0]?.count ?? 0;
        connectionAlive = true;
      } catch (e: any) {
        error = e.message;
        isCircuitBreakerBlocked = String(e.message || '').includes('ECIRCUITBREAKER');
      } finally {
        if (pool) {
          await pool.end().catch(() => {});
        }
      }
    } else {
      error = 'No valid database URL configured';
    }

    // Redact the password from the URL for safe logging
    const safeUrl = dbUrl ? dbUrl.replace(/:([^@:]+)@/, ':****@') : 'none';

    return NextResponse.json({
      status: connectionAlive ? 'connected' : 'disconnected',
      isMock: false,
      mockReason: null,
      isBuild,
      isProdWithoutDb,
      shopCount,
      environment: process.env.NODE_ENV,
      databaseUrlPrefix: dbUrl ? dbUrl.substring(0, 8) : 'none',
      databaseHost: safeUrl,
      isCircuitBreakerBlocked,
      error: error,
      rawConnectionTest: true,
      timestamp: new Date().toISOString(),
      hint: isCircuitBreakerBlocked
        ? 'Supabase circuit breaker is active. Wait 2-5 minutes without making connection attempts, then retry.'
        : undefined,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: e.message,
      },
      { status: 500 }
    );
  }
}
