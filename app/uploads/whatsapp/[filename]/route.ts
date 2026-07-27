import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/rbac';
import { promises as fs } from 'fs';
import path from 'path';
import { getConfig } from '@/lib/whatsapp/client';
import prisma from '@/lib/db';

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
    
    // 2. Check local disk first (private then public)
    const filePath = path.join(process.cwd(), 'private_uploads', 'whatsapp', cleanFileName);
    const legacyPath = path.join(process.cwd(), 'public', 'uploads', 'whatsapp', cleanFileName);

    let foundPath: string | null = null;
    try {
      await fs.access(filePath);
      foundPath = filePath;
    } catch {
      try {
        await fs.access(legacyPath);
        foundPath = legacyPath;
      } catch {}
    }

    if (foundPath) {
      const fileBuffer = await fs.readFile(foundPath);
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
    }

    // 3. Disk Miss Fallback: Find DB record & attempt Meta Graph API live proxy fetch
    const msg = await prisma.whatsAppMessage.findFirst({
      where: {
        OR: [
          { mediaUrl: { contains: cleanFileName } },
          { body: { contains: cleanFileName } }
        ]
      },
      select: { waMessageId: true }
    }).catch(() => null);

    if (msg?.waMessageId) {
      let resolvedMetaMediaId: string | null = null;

      if (/^\d+$/.test(msg.waMessageId)) {
        resolvedMetaMediaId = msg.waMessageId;
      } else {
        const events = await prisma.whatsAppWebhookEvent.findMany({
          take: 200,
          orderBy: { createdAt: 'desc' }
        }).catch(() => []);

        for (const ev of events) {
          const payloadStr = JSON.stringify(ev.payload || {});
          if (payloadStr.includes(msg.waMessageId)) {
            const entry = (ev.payload as any)?.entry?.[0];
            const change = entry?.changes?.[0]?.value;
            const messages = change?.messages || [];
            const matchedMsg = messages.find((m: any) => m.id === msg.waMessageId);
            if (matchedMsg) {
              const mType = matchedMsg.type;
              const mediaObj = matchedMsg[mType];
              if (mediaObj?.id) {
                resolvedMetaMediaId = mediaObj.id;
                break;
              }
            }
          }
        }
      }

      if (resolvedMetaMediaId) {
        try {
          const config = await getConfig();
          const accessToken = config.accessToken || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

          if (accessToken) {
            const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
            const metaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${resolvedMetaMediaId}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (metaRes.ok) {
              const metaData = await metaRes.json();
              if (metaData.url) {
                const mediaRes = await fetch(metaData.url, {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (mediaRes.ok) {
                  const contentType = mediaRes.headers.get('content-type') || metaData.mime_type || 'application/octet-stream';
                  const buffer = await mediaRes.arrayBuffer();

                  return new NextResponse(buffer, {
                    headers: {
                      'Content-Type': contentType,
                      'Cache-Control': 'private, max-age=3600'
                    }
                  });
                }
              }
            }
          }
        } catch (metaErr: any) {
          console.warn('[WhatsApp Legacy Uploads Route] Meta Graph API fallback fetch error:', metaErr?.message);
        }
      }
    }

    return NextResponse.json(
      { 
        error: 'Media unavailable', 
        code: 'MEDIA_UNAVAILABLE',
        message: 'Media file is no longer available on local disk or Meta WhatsApp servers.' 
      }, 
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error processing media request' }, { status: 500 });
  }
}
