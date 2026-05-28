import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Test 1: Raw count
    const count = await prisma.featuredUser.count();
    
    // Test 2: findMany without any filter
    const allUsers = await prisma.featuredUser.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        isTopFeatured: true,
        imageUrl: true,
      }
    });
    
    // Test 3: findMany with status filter
    const approvedUsers = await prisma.featuredUser.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        name: true,
        status: true,
      }
    });
    
    // Test 4: Raw SQL
    let rawResult: any = [];
    try {
      rawResult = await prisma.$queryRawUnsafe('SELECT id, name, status FROM "FeaturedUser" LIMIT 10');
    } catch (e: any) {
      rawResult = { error: e.message };
    }

    return NextResponse.json({
      totalCount: count,
      allUsers,
      approvedUsers,
      rawResult,
      prismaIsMock: (prisma as any)._isMock || false,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack?.substring(0, 500),
    }, { status: 500 });
  }
}
