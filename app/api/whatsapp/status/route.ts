import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!token || !phoneNumberId) {
    return NextResponse.json({
      connected: false,
      error: 'WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN in environment variables.',
    });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating&access_token=${token}`,
      { cache: 'no-store' }
    );
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({
        connected: false,
        error: data.error.message || 'Meta API returned an error',
      });
    }

    return NextResponse.json({
      connected: true,
      phone: data.display_phone_number || '',
      name: data.verified_name || '',
      quality: data.quality_rating || 'UNKNOWN',
      wabaId: wabaId || '',
    });
  } catch (err: any) {
    console.error('[WhatsApp Status] Check failed:', err.message);
    return NextResponse.json({
      connected: false,
      error: 'Unable to reach Meta Graph API',
    });
  }
}
