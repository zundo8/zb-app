import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle');

  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      if (handle) {
        const policy = await prisma.policy.findUnique({
          where: { handle },
          select: {
            title: true,
            content: true,
            updatedAt: true,
          }
        });
        
        if (!policy) {
          return NextResponse.json({ error: 'Policy not found' }, { 
            status: 404,
            headers: { 'Access-Control-Allow-Origin': '*' }
          });
        }

        return NextResponse.json(policy, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }

      const policies = await prisma.policy.findMany({
        select: {
          handle: true,
          title: true,
        },
        orderBy: { handle: 'asc' }
      });

      return NextResponse.json({ policies }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  try {
    if (handle) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/Policy?select=title,content,updatedAt&handle=eq.${handle}`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          next: { revalidate: 300, tags: ['policies'] },
        }
      );
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        throw new Error(res.statusText);
      }
      const data = await res.json();
      const policy = data?.[0] || null;
      if (!policy) {
        return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return NextResponse.json(policy, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/Policy?select=handle,title&order=handle.asc`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: ['policies'] },
      }
    );
    if (!res.ok) throw new Error(res.statusText);
    const policies = await res.json();
    return NextResponse.json({ policies }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (e: any) {
    console.error('[App API] Policy REST fetch failed, falling back to Prisma:', e.message);
    try {
      if (handle) {
        const policy = await prisma.policy.findUnique({
          where: { handle },
          select: {
            title: true,
            content: true,
            updatedAt: true,
          }
        });
        if (!policy) {
          return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        return NextResponse.json(policy, {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      const policies = await prisma.policy.findMany({
        select: {
          handle: true,
          title: true,
        },
        orderBy: { handle: 'asc' }
      });
      return NextResponse.json({ policies }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (fallbackErr: any) {
      return NextResponse.json({ error: fallbackErr.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  }
}
