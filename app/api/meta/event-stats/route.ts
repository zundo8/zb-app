import { NextResponse } from 'next/server';

export async function GET() {
  const PIXEL_ID = process.env.META_PIXEL_ID!;
  const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN!;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Meta Pixel ID or Access Token is not configured' }, { status: 400 });
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}?fields=name,creation_time,last_fired_time,stats&access_token=${ACCESS_TOKEN}`;

    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) {
      console.error('[Meta Event Stats API Error]', data);
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[Meta Event Stats Catch Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch event stats' }, { status: 500 });
  }
}
