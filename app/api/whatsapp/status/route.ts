import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await getConfig();

  if (!config.configured) {
    return NextResponse.json({
      connected: false,
      error: config.error || 'WhatsApp credentials not configured.',
    });
  }

  const { phoneId, wabaId, accessToken } = config;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

  try {
    // 1. Fetch Phone Number details (Display Name, Display Phone, Quality, Limit Tier)
    const phoneRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneId}?fields=display_phone_number,verified_name,quality_rating,status,messaging_limit_tier&access_token=${accessToken}`,
      { cache: 'no-store' }
    );
    const phoneData = await phoneRes.json();

    if (phoneData.error) {
      return NextResponse.json({
        connected: false,
        error: phoneData.error.message || 'Meta API returned an error verifying Phone ID',
      });
    }

    // 2. Fetch Business Account name
    let businessName = '';
    try {
      const wabaRes = await fetch(
        `https://graph.facebook.com/${apiVersion}/${wabaId}?fields=name&access_token=${accessToken}`,
        { cache: 'no-store' }
      );
      const wabaData = await wabaRes.json();
      if (!wabaData.error) {
        businessName = wabaData.name || '';
      }
    } catch (e: any) {
      console.warn('[WhatsApp Status] Failed to fetch WABA business name:', e.message);
    }

    // 3. Verify App Subscription to WABA
    let webhookSubscribed = false;
    try {
      const subRes = await fetch(
        `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps?access_token=${accessToken}`,
        { cache: 'no-store' }
      );
      const subData = await subRes.json();
      if (subData && Array.isArray(subData.data)) {
        // If there are subscribed apps, then it is subscribed
        webhookSubscribed = subData.data.length > 0;
      }
    } catch (e: any) {
      console.warn('[WhatsApp Status] Failed to verify webhook subscription:', e.message);
    }

    return NextResponse.json({
      connected: true,
      phone: phoneData.display_phone_number || '',
      phoneId: phoneId,
      wabaId: wabaId,
      name: phoneData.verified_name || businessName || 'WhatsApp Business Account',
      quality: phoneData.quality_rating || 'UNKNOWN',
      tier: phoneData.messaging_limit_tier || 'TIER_UNKNOWN',
      status: phoneData.status || 'UNKNOWN',
      webhookSubscribed,
    });
  } catch (err: any) {
    console.error('[WhatsApp Status] Handshake failed:', err.message);
    return NextResponse.json({
      connected: false,
      error: 'Unable to reach Meta Graph API. Check network and token status.',
    });
  }
}

