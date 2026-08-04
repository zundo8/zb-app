/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

// Valid platform values for allow-list validation (Item 6)
const VALID_PLATFORMS = ['web', 'app'] as const;

async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const rawPlatform = searchParams.get('platform');

    // Validate platform against allow-list (Item 6)
    const platform = rawPlatform && (VALID_PLATFORMS as readonly string[]).includes(rawPlatform) ? rawPlatform : null;

    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rawEnd = to ? new Date(to) : now;
    const endDate = rawEnd > now ? now : rawEnd;

    // Parameterized platform condition (Item 6 — kill SQL injection)
    const platformCondition = platform ? `AND platform = $3` : '';
    const queryArgs: any[] = platform ? [startDate, endDate, platform] : [startDate, endDate];

    const funnelStages = ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase'];

    // Single consolidated SQL aggregation for all stages — parameterized
    const rawCounts: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        event_name,
        COUNT(DISTINCT session_id) AS sessions,
        COUNT(DISTINCT anonymous_id) AS users
      FROM analytics_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name IN ('page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase')
        ${platformCondition}
      GROUP BY event_name
    `, ...queryArgs);

    const countsMap = new Map<string, { sessions: number; users: number }>();
    rawCounts.forEach((r: any) => {
      countsMap.set(r.event_name, {
        sessions: Number(r.sessions || 0),
        users: Number(r.users || 0),
      });
    });

    const stageData = funnelStages.map((eventName) => {
      const data = countsMap.get(eventName) || { sessions: 0, users: 0 };
      return {
        stage: eventName,
        sessions: data.sessions,
        users: data.users,
      };
    });

    // Calculate conversion and drop-off rates
    const funnel = stageData.map((stage, index) => {
      const prevStage = index > 0 ? stageData[index - 1] : null;
      const firstStage = stageData[0];

      return {
        stage: stage.stage,
        sessions: stage.sessions,
        users: stage.users,
        conversionFromPrevious: prevStage && prevStage.sessions > 0
          ? Math.round((stage.sessions / prevStage.sessions) * 100 * 10) / 10
          : 100,
        conversionFromFirst: firstStage.sessions > 0
          ? Math.round((stage.sessions / firstStage.sessions) * 100 * 10) / 10
          : 100,
        dropOff: prevStage
          ? Math.round(((prevStage.sessions - stage.sessions) / Math.max(prevStage.sessions, 1)) * 100 * 10) / 10
          : 0,
        dropOffCount: prevStage ? prevStage.sessions - stage.sessions : 0,
      };
    });

    return NextResponse.json({ funnel });
  } catch (error: any) {
    console.error('[Analytics Funnel] Error:', error.message);
    return NextResponse.json({ funnel: [], error: error.message });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
