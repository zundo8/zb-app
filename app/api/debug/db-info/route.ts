import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const shop = await prisma.shop.findFirst({
      select: {
        id: true,
        domain: true,
      }
    });

    const dbUrl = process.env.DATABASE_URL || '';
    const supabaseUrl = process.env.SUPABASE_DATABASE_URL || '';
    const postgresUrl = process.env.POSTGRES_URL || '';
    const postgresPrismaUrl = process.env.POSTGRES_PRISMA_URL || '';

    return NextResponse.json({
      shopId: shop?.id || null,
      shopDomain: shop?.domain || null,
      databaseUrlPrefix: dbUrl ? dbUrl.split('@')[1]?.substring(0, 30) : null,
      supabaseUrlPrefix: supabaseUrl ? supabaseUrl.split('@')[1]?.substring(0, 30) : null,
      postgresUrlPrefix: postgresUrl ? postgresUrl.split('@')[1]?.substring(0, 30) : null,
      postgresPrismaUrlPrefix: postgresPrismaUrl ? postgresPrismaUrl.split('@')[1]?.substring(0, 30) : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
