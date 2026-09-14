import { NextResponse } from 'next/server';
import { uploadToStorage } from '@/lib/storage';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';
import { sniffImageType, validateFileSize } from '@/lib/upload-validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/upload-image
 * Accepts a multipart/form-data request with a 'file' field.
 * Saves the image persistently to Supabase Storage.
 */
export async function POST(req: Request) {
  try {
    await requirePermission('PRODUCTS', 'edit');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (first-pass extension check)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp|gif|avif|heic|heif)$/i)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF allowed.' }, { status: 400 });
    }

    // Cap file size to 10 MB
    const sizeError = validateFileSize(file.size);
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Authoritative magic-byte validation
    const sniffed = sniffImageType(buffer);
    if (!sniffed) {
      return NextResponse.json({ error: 'File content is not a valid image.' }, { status: 400 });
    }

    const result = await uploadToStorage(buffer, file.type, file.name);
    return NextResponse.json({ success: true, url: result.url, fallback: result.fallback });
  } catch (error: any) {
    if (error?.message === '401' || error?.message === '403') {
      return handleAuthError(error);
    }
    console.error('[Image Upload Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
