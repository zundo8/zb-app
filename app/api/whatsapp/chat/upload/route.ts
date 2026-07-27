import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAuth, handleAuthError } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Admin Session Authentication
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: 'Unauthorized. Admin dashboard authentication required.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate clean unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.name) || '.jpg';
    const filename = `${uniqueSuffix}${fileExtension}`;

    // Infer mediaType based on mime type or extension
    const mime = file.type || 'application/octet-stream';
    const ext = (path.extname(file.name) || '').toLowerCase();
    let mediaType = 'document';

    if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
      mediaType = 'image';
    } else if (mime.startsWith('video/') || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp'].includes(ext)) {
      mediaType = 'video';
    } else if (mime.startsWith('audio/') || ['.mp3', '.ogg', '.wav', '.aac', '.m4a'].includes(ext)) {
      mediaType = 'audio';
    } else {
      mediaType = 'document';
    }

    // Save to private uploads directory for authenticated access only
    const privateUploadDir = path.join(process.cwd(), 'private_uploads', 'whatsapp');
    await fs.mkdir(privateUploadDir, { recursive: true });
    const filePath = path.join(privateUploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/api/whatsapp/chat/media?file=${filename}`;

    return NextResponse.json({ 
      success: true, 
      url: fileUrl, 
      mediaType, 
      filename: file.name 
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
