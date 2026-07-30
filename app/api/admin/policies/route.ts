import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const handle = searchParams.get('handle');

    if (id) {
      const policy = await prisma.policy.findUnique({
        where: { id }
      });
      return NextResponse.json(policy || { error: 'Policy not found' }, { status: policy ? 200 : 404 });
    }

    if (handle) {
      const policy = await prisma.policy.findUnique({
        where: { handle }
      });
      return NextResponse.json(policy || { error: 'Policy not found' }, { status: policy ? 200 : 404 });
    }

    const policies = await prisma.policy.findMany({
      orderBy: { handle: 'asc' }
    });
    return NextResponse.json(policies);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, handle, content } = body;

    const newPolicy = await prisma.policy.create({
      data: {
        title,
        handle,
        content
      }
    });

    try {
      revalidatePath('/policies/[handle]', 'page');
      if (newPolicy.handle) revalidatePath(`/policies/${newPolicy.handle}`);
    } catch {}

    return NextResponse.json({ success: true, policy: newPolicy });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, title, handle, content } = body;

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const updatedPolicy = await prisma.policy.update({
      where: { id },
      data: {
        title,
        handle,
        content
      }
    });

    try {
      revalidatePath('/policies/[handle]', 'page');
      if (updatedPolicy.handle) revalidatePath(`/policies/${updatedPolicy.handle}`);
    } catch {}

    return NextResponse.json({ success: true, policy: updatedPolicy });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const deletedPolicy = await prisma.policy.delete({
      where: { id }
    });

    try {
      revalidatePath('/policies/[handle]', 'page');
      if (deletedPolicy.handle) revalidatePath(`/policies/${deletedPolicy.handle}`);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
