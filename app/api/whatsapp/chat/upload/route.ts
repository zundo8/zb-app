import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create folder structure programmatically
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'whatsapp');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate clean unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.name) || '.jpg';
    const filename = `${uniqueSuffix}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);

    // Infer mediaType based on mime type or extension
    const mime = file.type || '';
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

    // Write file
    await fs.writeFile(filePath, buffer);

    // Build URL (using hostname from headers, falling back to app.zicabella.com)
    const host = req.headers.get('host') || 'app.zicabella.com';
    const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
    const fileUrl = `${baseUrl}/uploads/whatsapp/${filename}`;

    return NextResponse.json({ 
      success: true, 
      url: fileUrl, 
      mediaType, 
      filename: file.name 
    });
  } catch (error: any) {
    console.error('[WhatsApp Chat Upload API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
