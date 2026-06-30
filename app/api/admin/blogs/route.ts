import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Fetch all posts or single post by ID
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const post = await prisma.blogPost.findUnique({
        where: { id }
      });
      return NextResponse.json(post || { error: 'Blog post not found' }, { status: post ? 200 : 404 });
    }

    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(posts);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Create a blog post with SEO and backlink settings
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      title, 
      slug, 
      excerpt, 
      content, 
      coverImage, 
      published, 
      author,
      metaTitle,
      metaDescription,
      backlinkUrl,
      backlinkText,
      indexPref
    } = body;

    const newPost = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage,
        published: !!published,
        author: author || 'Zica Bella',
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        backlinkUrl: backlinkUrl || null,
        backlinkText: backlinkText || null,
        indexPref: indexPref !== undefined ? !!indexPref : true
      }
    });

    return NextResponse.json({ success: true, post: newPost });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: Update a blog post
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { 
      id, 
      title, 
      slug, 
      excerpt, 
      content, 
      coverImage, 
      published, 
      author,
      metaTitle,
      metaDescription,
      backlinkUrl,
      backlinkText,
      indexPref
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const updatedPost = await prisma.blogPost.update({
      where: { id },
      data: {
        title,
        slug,
        excerpt,
        content,
        coverImage,
        published: typeof published === 'boolean' ? published : undefined,
        author,
        metaTitle: metaTitle !== undefined ? (metaTitle || null) : undefined,
        metaDescription: metaDescription !== undefined ? (metaDescription || null) : undefined,
        backlinkUrl: backlinkUrl !== undefined ? (backlinkUrl || null) : undefined,
        backlinkText: backlinkText !== undefined ? (backlinkText || null) : undefined,
        indexPref: typeof indexPref === 'boolean' ? indexPref : undefined
      }
    });

    return NextResponse.json({ success: true, post: updatedPost });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: Delete a post
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    await prisma.blogPost.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
