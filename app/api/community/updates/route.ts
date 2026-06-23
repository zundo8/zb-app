import { NextResponse } from 'next/server';
import prisma from "@/lib/db";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    try {
      const updates = await prisma.communityUpdate.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ updates });
    } catch (error) {
      console.error('Community Update GET Error:', error);
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/CommunityUpdate?select=*&order=createdAt.desc`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300, tags: ['community'] },
      }
    );

    if (!res.ok) {
      throw new Error(`REST fetch failed: ${res.statusText}`);
    }

    const updates = await res.json();
    return NextResponse.json({ updates });
  } catch (error: any) {
    console.error('Community Update GET Error (Supabase fetch failed, falling back to Prisma):', error.message);
    try {
      const updates = await prisma.communityUpdate.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json({ updates });
    } catch (fallbackError) {
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }
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
