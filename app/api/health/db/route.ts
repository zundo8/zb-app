import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isMock = Boolean((db as any)?._isMock);
    if (isMock) {
      return NextResponse.json({
        status: 'unhealthy',
        database: 'mock_fallback',
        isMock: true,
        reason: (db as any)?._mockReason || 'ALLOW_DB_MOCK active',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    const startTime = Date.now();
    const result = await db.$queryRaw`SELECT 1 as connected`;
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      isMock: false,
      latencyMs,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      isMock: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
