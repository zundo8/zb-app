import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Convert to Base64 Data URI to support Vercel/Serverless where filesystem is read-only
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const url = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
