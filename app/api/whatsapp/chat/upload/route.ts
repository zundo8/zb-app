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

    // Write file
    await fs.writeFile(filePath, buffer);

    // Build URL (using hostname from headers, falling back to app.zicabella.com)
    const host = req.headers.get('host') || 'app.zicabella.com';
    const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
    const fileUrl = `${baseUrl}/uploads/whatsapp/${filename}`;

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error('[WhatsApp Chat Upload API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
