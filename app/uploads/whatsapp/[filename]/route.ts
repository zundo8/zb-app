import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  try {
    // 1. Enforce Admin Session Authentication
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ 
        error: 'Unauthorized. Admin dashboard authentication required.' 
      }, { status: 401 });
    }

    const filename = params.filename;
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const cleanFileName = path.basename(filename);
    let filePath = path.join(process.cwd(), 'private_uploads', 'whatsapp', cleanFileName);
    
    try {
      await fs.access(filePath);
    } catch {
      filePath = path.join(process.cwd(), 'public', 'uploads', 'whatsapp', cleanFileName);
    }

    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(cleanFileName).toLowerCase();
    
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.mp3') contentType = 'audio/mpeg';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
  }
}
