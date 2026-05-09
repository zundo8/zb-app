import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');

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
