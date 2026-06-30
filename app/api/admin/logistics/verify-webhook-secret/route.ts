import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { resolveWebhookSecret } from '@/lib/services/logistics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const envSecret = process.env.DELHIVERY_WEBHOOK_SECRET?.trim() || '';

    const shop = await prisma.shop.findFirst({ select: { webhookSecret: true } });
    const dbSecret = shop?.webhookSecret?.trim() || '';

    const isEnvSet = envSecret.length > 0;
    const isDbSet = dbSecret.length > 0;

    const match = envSecret === dbSecret;

    const { source } = await resolveWebhookSecret();

    return NextResponse.json({
      envSecretSet: isEnvSet,
      dbSecretSet: isDbSet,
      secretsMatch: match,
      activeSource: source,
    });
  } catch (error: any) {
    console.error('[Admin API] verify-webhook-secret Error:', error.message);
    return NextResponse.json({ error: 'Failed to verify webhook secrets' }, { status: 500 });
  }
}
