import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const { searchParams } = new URL(req.url);
  const isTopFeatured = searchParams.get('isTopFeatured') === 'true';

  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      const where: any = { status: 'APPROVED' };
      if (isTopFeatured) {
        where.isTopFeatured = true;
      }
      const users = await prisma.featuredUser.findMany({
        where,
        include: {
          reviews: true,
        },
        orderBy: { createdAt: 'desc' },
        take: isTopFeatured ? 20 : undefined,
      });
      return NextResponse.json({ users }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  try {
    const filterQuery = [
      'status=eq.APPROVED',
      'order=createdAt.desc',
      isTopFeatured ? 'isTopFeatured=eq.true&limit=20' : ''
    ].filter(Boolean).join('&');

    const res = await fetch(
      `${supabaseUrl}/rest/v1/FeaturedUser?select=*,reviews(*)&${filterQuery}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: ['featured-users'] },
      }
    );

    if (!res.ok) {
      throw new Error(`REST fetch failed: ${res.statusText}`);
    }

    const users = await res.json();
    return NextResponse.json({ users }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error: any) {
    console.error("[Featured Users GET] Supabase fetch failed, falling back to Prisma:", error.message);
    try {
      const where: any = { status: 'APPROVED' };
      if (isTopFeatured) {
        where.isTopFeatured = true;
      }
      const users = await prisma.featuredUser.findMany({
        where,
        include: {
          reviews: true,
        },
        orderBy: { createdAt: 'desc' },
        take: isTopFeatured ? 20 : undefined,
      });
      return NextResponse.json({ users }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    } catch (fallbackError: any) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, imageUrl, styleDescription, instagramUrl } = body;

    const user = await prisma.featuredUser.create({
      data: {
        name,
        email,
        imageUrl,
        styleDescription,
        instagramUrl,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
