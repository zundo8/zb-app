import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawUrl = process.env.DATABASE_URL || '';
  let dbHost = 'N/A';
  let dbName = 'N/A';
  try {
    if (rawUrl && !rawUrl.startsWith('file:')) {
      const parsed = new URL(rawUrl.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
      dbHost = parsed.host;
      dbName = parsed.pathname;
    }
  } catch (e) {}

  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? 'PRESENT (hidden)' : 'MISSING',
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? 'PRESENT (hidden)' : 'MISSING',
    POSTGRES_URL: process.env.POSTGRES_URL ? 'PRESENT (hidden)' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PHASE: process.env.NEXT_PHASE,
    dbHost,
    dbName,
  };

  try {
    // Attempt a real DB operation
    const shopCount = await prisma.shop.count();
    return NextResponse.json({
      status: 'connected',
      isMock: (prisma as any)._isMock || false,
      mockReason: (prisma as any)._mockReason || null,
      dbType: prisma.constructor.name,
      shopCount,
      envVars
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      envVars
    }, { status: 500 });
  }
}
