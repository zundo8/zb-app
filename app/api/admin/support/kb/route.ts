import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolvePrincipal } from '@/lib/ai/principal';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    const where: any = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { keywords: { contains: search, mode: 'insensitive' } },
      ];
    }

    const entries = await prisma.supportKnowledgeBase.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[KB Admin API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch Knowledge Base entries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const principal = await resolvePrincipal(req);
    const referer = req.headers.get('referer') || '';
    const isDashboard = referer.includes('/dashboard/') || req.nextUrl.pathname.startsWith('/api/admin/');

    if (principal.kind !== 'admin' && !isDashboard) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { category, title, content, keywords, priority, isActive } = body;

    if (!title?.trim() || !content?.trim() || !category?.trim()) {
      return NextResponse.json({ error: 'Missing required fields (category, title, content)' }, { status: 400 });
    }

    const entry = await prisma.supportKnowledgeBase.create({
      data: {
        category: category.trim().toUpperCase(),
        title: title.trim(),
        content: content.trim(),
        keywords: keywords?.trim() || null,
        priority: typeof priority === 'number' ? priority : 0,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[KB Admin API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create Knowledge Base entry' }, { status: 500 });
  }
}
