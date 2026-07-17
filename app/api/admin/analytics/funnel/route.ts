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
  endDate.setHours(23, 59, 59, 999);

  const dateFilter = { gte: startDate, lte: endDate };
  const platformFilter = platform ? { platform } : {};

  const funnelStages = ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'payment_initiated', 'purchase'];

  // Get unique sessions at each stage
  const stageData = await Promise.all(
    funnelStages.map(async (eventName) => {
      const [sessionCount, userCount] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where: { eventName, createdAt: dateFilter, ...platformFilter },
          select: { sessionId: true },
          distinct: ['sessionId'],
        }),
        prisma.analyticsEvent.findMany({
          where: { eventName, createdAt: dateFilter, ...platformFilter },
          select: { anonymousId: true },
          distinct: ['anonymousId'],
        }),
      ]);

      return {
        stage: eventName,
        sessions: sessionCount.filter((s: any) => s.sessionId).length,
        users: userCount.filter((u: any) => u.anonymousId).length,
      };
    })
  );

  // Calculate conversion and drop-off
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
    return NextResponse.json({ funnel: [], error: error.message }, { status: 200 });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
