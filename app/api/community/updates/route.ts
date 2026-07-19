import { NextResponse } from 'next/server';
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const updates = await prisma.communityUpdate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ updates });
  } catch (error: any) {
    console.error('Community Update GET Error (Direct Prisma query failed):', error.message);
    return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, type, imageUrl } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const update = await prisma.communityUpdate.create({
      data: {
        title,
        description,
        type: type || 'EVENT',
        imageUrl
      }
    });

    return NextResponse.json({ update });
  } catch (error) {
    console.error('Community Update POST Error:', error);
    return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.communityUpdate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Community Update DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete update' }, { status: 500 });
  }
}
