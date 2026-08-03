/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const platform = searchParams.get('platform');

    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = to ? new Date(to) : now;

    const platformSql = platform ? `AND platform = '${platform}'` : '';

    const funnelStages = ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase'];

    // Single consolidated SQL aggregation for all stages
    const rawCounts: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        event_name,
        COUNT(DISTINCT session_id) AS sessions,
        COUNT(DISTINCT anonymous_id) AS users
      FROM analytics_events
      WHERE created_at >= $1 AND created_at <= $2
        AND event_name IN ('page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase')
        ${platformSql}
      GROUP BY event_name
    `, startDate, endDate);

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
