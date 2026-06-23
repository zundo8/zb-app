// /app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { secret, path, tag } = await request.json();
    if (secret !== process.env.REVALIDATION_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }
    if (tag) {
      revalidateTag(tag);
      console.log(`[Revalidate API] Revalidated tag: ${tag}`);
    }
    if (path) {
      revalidatePath(path);
      console.log(`[Revalidate API] Revalidated path: ${path}`);
    }
    return NextResponse.json({ revalidated: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bad Request' }, { status: 400 });
  }
}
