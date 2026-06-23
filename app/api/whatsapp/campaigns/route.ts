/**
 * WhatsApp Campaign Management API Route
 * Location: app/api/whatsapp/campaigns/route.ts
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET — List all campaigns
 */
export async function GET() {
  try {
    const campaigns = await prisma.whatsAppCampaign.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('[WhatsApp Campaigns API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
