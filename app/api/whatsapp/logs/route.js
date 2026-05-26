/**
 * WhatsApp Message Logs Fetch Endpoint
 * Location: app/api/whatsapp/logs/route.js
 */

import { NextResponse } from 'next/server';
import { getLogs } from '@/lib/whatsapp/logger';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const type = searchParams.get('type') || '';

    const { logs, totalCount } = await getLogs({ page, limit, type });

    return NextResponse.json({
      logs,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('[WhatsApp Logs API] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
