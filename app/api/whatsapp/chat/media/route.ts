import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json({ error: 'Missing mediaId parameter' }, { status: 400 });
    }

    const config = await getConfig();
    const accessToken = config.accessToken || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json({ error: 'WhatsApp API token not configured' }, { status: 500 });
    }

    // Step 1: Query Meta Graph API for media metadata URL
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
    const metaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('[WhatsApp Media Proxy] Meta metadata error:', errText);
      return NextResponse.json({ error: 'Failed to fetch media metadata from Meta' }, { status: metaRes.status });
    }

    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;

    if (!downloadUrl) {
      return NextResponse.json({ error: 'Meta media URL missing' }, { status: 404 });
    }

    // Step 2: Download media binary stream from Meta
    const mediaRes = await fetch(downloadUrl, {
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
        'Cache-Control': 'public, max-age=86400, immutable'
      }
    });
  } catch (error: any) {
    console.error('[WhatsApp Media Proxy Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
