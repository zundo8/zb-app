/**
 * WhatsApp Single Campaign Fetch API Route
 * Location: app/api/whatsapp/campaigns/[id]/route.ts
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: 'Missing campaign ID' }, { status: 400 });
    }

    const campaign = await prisma.whatsAppCampaign.findUnique({
      where: { id },
      include: {
        recipients: {
          orderBy: { phone: 'asc' }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error: any) {
    console.error(`[WhatsApp Single Campaign API] GET error for ${params.id}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
