import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolvePrincipal } from '@/lib/ai/principal';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const principal = await resolvePrincipal(req);
    const referer = req.headers.get('referer') || '';
    const isDashboard = referer.includes('/dashboard/') || req.nextUrl.pathname.startsWith('/api/admin/');

    if (principal.kind !== 'admin' && !isDashboard) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { category, title, content, keywords, priority, isActive } = body;

    const existing = await prisma.supportKnowledgeBase.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Knowledge Base entry not found' }, { status: 404 });
    }

    const updated = await prisma.supportKnowledgeBase.update({
      where: { id },
      data: {
        ...(category && { category: category.trim().toUpperCase() }),
        ...(title && { title: title.trim() }),
        ...(content && { content: content.trim() }),
        ...(keywords !== undefined && { keywords: keywords?.trim() || null }),
        ...(typeof priority === 'number' && { priority }),
        ...(typeof isActive === 'boolean' && { isActive }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ entry: updated });
  } catch (error) {
    console.error('[KB Admin API] PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update Knowledge Base entry' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const principal = await resolvePrincipal(req);
    const referer = req.headers.get('referer') || '';
    const isDashboard = referer.includes('/dashboard/') || req.nextUrl.pathname.startsWith('/api/admin/');

    if (principal.kind !== 'admin' && !isDashboard) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.supportKnowledgeBase.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[KB Admin API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete Knowledge Base entry' }, { status: 500 });
  }
}
