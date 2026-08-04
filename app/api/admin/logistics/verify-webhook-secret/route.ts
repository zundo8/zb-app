import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { resolveWebhookSecret, validateWebhookSignature } from '@/lib/services/logistics';

export const dynamic = 'force-dynamic';

async function getSecretStatus() {
  const envSecret = process.env.DELHIVERY_WEBHOOK_SECRET?.trim() || '';
  const shop = await prisma.shop.findFirst({ select: { webhookSecret: true } });
  const dbSecret = shop?.webhookSecret?.trim() || '';

  const envSecretSet = envSecret.length > 0;
  const dbSecretSet = dbSecret.length > 0;
  const secretsMatch = envSecret === dbSecret;
  const { secret, source } = await resolveWebhookSecret();
  const mode = (process.env.DELHIVERY_WEBHOOK_MODE || 'token').trim().toLowerCase();

  return { envSecretSet, dbSecretSet, secretsMatch, activeSource: source, mode, secret };
}

export async function GET(req: NextRequest) {
  try {
    const { envSecretSet, dbSecretSet, secretsMatch, activeSource, mode } = await getSecretStatus();

    return NextResponse.json({
      envSecretSet,
      dbSecretSet,
      secretsMatch,
      activeSource,
      mode,
    });
  } catch (error: any) {
    console.error('[Admin API] verify-webhook-secret Error:', error.message);
    return NextResponse.json({ error: 'Failed to verify webhook secrets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { envSecretSet, dbSecretSet, secretsMatch, activeSource, mode, secret } = await getSecretStatus();

    let signature = '';
    let rawBody = '';
    try {
      const body = await req.json();
      signature = body.signature || body.token || '';
      rawBody = body.rawBody || body.payload || '';
    } catch {}

    const wouldAccept = secret && signature
      ? validateWebhookSignature(rawBody, signature, secret, 'delhivery')
      : false;

    return NextResponse.json({
      envSecretSet,
      dbSecretSet,
      secretsMatch,
      activeSource,
      mode,
      wouldAccept,
    });
  } catch (error: any) {
    console.error('[Admin API] verify-webhook-secret POST Error:', error.message);
    return NextResponse.json({ error: 'Failed to test webhook secret' }, { status: 500 });
  }
}
