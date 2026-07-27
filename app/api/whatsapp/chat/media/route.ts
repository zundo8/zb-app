import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAuth, handleAuthError } from '@/lib/auth/rbac';
import { getConfig } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Enforce Admin Session Authentication
    try {
      await requireAuth();
    } catch (authErr) {
      return NextResponse.json({ 
        error: 'Unauthorized. Admin login required to view WhatsApp media.' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get('mediaId');
    const fileName = searchParams.get('file');

    // 2. Serve from secure private uploads directory if fileName is provided
    if (fileName) {
      const cleanFileName = path.basename(fileName);
      const filePath = path.join(process.cwd(), 'private_uploads', 'whatsapp', cleanFileName);

      try {
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
        else if (ext === '.ogg') contentType = 'audio/ogg';

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private, max-age=3600, no-transform'
          }
        });
      } catch (fileErr) {
        // Fallback: check legacy public directory if present
        const legacyPath = path.join(process.cwd(), 'public', 'uploads', 'whatsapp', cleanFileName);
        try {
          const fileBuffer = await fs.readFile(legacyPath);
          const ext = path.extname(cleanFileName).toLowerCase();
          
          let contentType = 'image/jpeg';
          if (ext === '.png') contentType = 'image/png';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.mp4') contentType = 'video/mp4';
          else if (ext === '.pdf') contentType = 'application/pdf';

          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'private, max-age=3600'
            }
          });
        } catch (legacyErr) {
          // If file not on disk, return 404
        }
      }
    }

    // 3. Serve from Meta Graph API if mediaId is provided
    if (mediaId) {
      const config = await getConfig();
      const accessToken = config.accessToken || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

      if (!accessToken) {
        return NextResponse.json({ error: 'WhatsApp API token not configured' }, { status: 500 });
      }

      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
      const metaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!metaRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch media metadata from Meta' }, { status: metaRes.status });
      }

      const metaData = await metaRes.json();
      if (!metaData.url) {
        return NextResponse.json({ error: 'Meta media URL missing' }, { status: 404 });
      }

      const mediaRes = await fetch(metaData.url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!mediaRes.ok) {
        return NextResponse.json({ error: 'Failed to download media binary from Meta' }, { status: mediaRes.status });
      }

      const contentType = mediaRes.headers.get('content-type') || metaData.mime_type || 'application/octet-stream';
      const buffer = await mediaRes.arrayBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600'
        }
      });
    }

    return NextResponse.json({ error: 'Missing file or mediaId parameter' }, { status: 400 });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
