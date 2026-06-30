import { NextResponse } from 'next/server';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';
import { uploadSocialSharingImage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webstore-settings/upload-social-image
 * Accepts a multipart/form-data request with a 'file' field.
 * Saves the social sharing image persistently to the 'store-assets' bucket.
 */
export async function POST(req: Request) {
  try {
    await requirePermission('STOREFRONT', 'edit');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' }, { status: 400 });
    }

    // Cap file size to 5 MB per requirement
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadSocialSharingImage(buffer, file.type, file.name);
    return NextResponse.json({ success: true, url: result.url, fallback: result.fallback });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
