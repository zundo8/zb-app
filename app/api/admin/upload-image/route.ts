import { NextResponse } from 'next/server';
import { uploadToStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/upload-image
 * Accepts a multipart/form-data request with a 'file' field.
 * Saves the image persistently to Supabase Storage.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp|gif|avif|heic|heif)$/i)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF allowed.' }, { status: 400 });
    }

    // Cap file size to 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadToStorage(buffer, file.type, file.name);
    return NextResponse.json({ success: true, url: result.url, fallback: result.fallback });
  } catch (e: any) {
    console.error('[Image Upload Error]:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

