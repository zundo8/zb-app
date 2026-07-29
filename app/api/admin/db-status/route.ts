import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

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

    const isMock = Boolean((prisma as any)?._isMock);
    const mockReason = (prisma as any)?._mockReason || null;

    let connectionAlive = false;
    let error: string | null = null;
    let shopCount = 0;
    let isCircuitBreakerBlocked = false;

    if (isMock) {
      error = `Prisma running on Mock Fallback (${mockReason || 'ALLOW_DB_MOCK active'})`;
    } else if (!dbUrl || dbUrl.includes('placeholder') || dbUrl.includes('(not available)')) {
      error = 'No valid database URL configured';
    } else {
      try {
        shopCount = await prisma.shop.count();
        connectionAlive = true;
      } catch (e: any) {
        error = e.message;
        isCircuitBreakerBlocked = String(e.message || '').includes('ECIRCUITBREAKER');
      }
    }

    // Redact the password from the URL for safe output
    const safeUrl = dbUrl ? dbUrl.replace(/:([^@:]+)@/, ':****@') : 'none';

    return NextResponse.json({
      status: connectionAlive ? 'connected' : 'disconnected',
      isMock,
      mockReason,
      isBuild,
      shopCount,
      environment: process.env.NODE_ENV,
      databaseUrlPrefix: dbUrl ? dbUrl.substring(0, 8) : 'none',
      databaseHost: safeUrl,
      isCircuitBreakerBlocked,
      error: error,
      timestamp: new Date().toISOString(),
      hint: isCircuitBreakerBlocked
        ? 'Supabase circuit breaker is active. Wait 2-5 minutes without making connection attempts, then retry.'
        : isMock
        ? 'Running on mock data because database connection failed and ALLOW_DB_MOCK=true is set.'
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
