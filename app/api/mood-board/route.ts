import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/mood-board?productId=xxx — public endpoint for PDP
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const moodBoard = await prisma.productMoodBoard.findUnique({
      where: { shopifyProductId: productId },
    });

    if (!moodBoard) {
      return NextResponse.json({ images: [] });
    }

    let images: string[] = [];
    try {
      images = JSON.parse(moodBoard.images);
    } catch {
      images = [];
    }

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error('Public mood board GET error:', error);
    return NextResponse.json({ images: [] });
  }
}
