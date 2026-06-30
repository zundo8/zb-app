import { NextResponse } from 'next/server';
import { getMetaApiLogs, getMetaApiLogStats, clearMetaApiLogs } from '@/lib/metaApiLogger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/meta/logs — Returns recent Meta Graph API request logs for dashboard troubleshooting.
 */
export async function GET() {
  const logs = getMetaApiLogs();
  const stats = getMetaApiLogStats();

  return NextResponse.json({
    stats,
    logs,
    timestamp: new Date().toISOString(),
  });
}

/**
 * DELETE /api/meta/logs — Clear the in-memory log buffer.
 */
export async function DELETE() {
  clearMetaApiLogs();
  return NextResponse.json({ success: true, message: 'Meta API logs cleared' });
}
