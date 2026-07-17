/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAdminApiGuard } from '@/lib/auth/admin-api-guard';

export const dynamic = 'force-dynamic';

async function handler() {
  try {
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Active sessions (last 5 minutes)
  const activeSessions = await prisma.analyticsSession.findMany({
    where: { lastActiveAt: { gte: fiveMinAgo } },
    orderBy: { lastActiveAt: 'desc' },
    take: 100,
    select: {
      id: true,
      anonymousId: true,
      customerId: true,
      platform: true,
      currentPage: true,
      landingPage: true,
      pageViews: true,
      deviceType: true,
      browser: true,
      os: true,
      referrer: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      country: true,
      region: true,
      city: true,
      isNew: true,
      startedAt: true,
      lastActiveAt: true,
    },
  });

  // Calculate session duration for each
  const sessions = activeSessions.map((s: any) => ({
    ...s,
    duration: Math.round((now.getTime() - new Date(s.startedAt).getTime()) / 1000),
    isNewVisitor: s.isNew,
  }));

  // Summary counts
  const totalActive = sessions.length;
  const webActive = sessions.filter((s: any) => s.platform === 'web').length;
  const appActive = sessions.filter((s: any) => s.platform === 'app').length;
  const newVisitors = sessions.filter((s: any) => s.isNew).length;
  const returningVisitors = totalActive - newVisitors;

  // Device breakdown
  const deviceBreakdown: Record<string, number> = {};
  const browserBreakdown: Record<string, number> = {};
  const osBreakdown: Record<string, number> = {};
  const countryBreakdown: Record<string, number> = {};

  for (const s of sessions) {
    const dt = s.deviceType || 'unknown';
    deviceBreakdown[dt] = (deviceBreakdown[dt] || 0) + 1;
    const br = s.browser || 'unknown';
    browserBreakdown[br] = (browserBreakdown[br] || 0) + 1;
    const os = s.os || 'unknown';
    osBreakdown[os] = (osBreakdown[os] || 0) + 1;
    const co = s.country || 'unknown';
    countryBreakdown[co] = (countryBreakdown[co] || 0) + 1;
  }

  // Top pages right now
  const pageBreakdown: Record<string, number> = {};
  for (const s of sessions) {
    const page = s.currentPage || 'unknown';
    pageBreakdown[page] = (pageBreakdown[page] || 0) + 1;
  }

  const topPages = Object.entries(pageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([page, count]) => ({ page, count }));

  return NextResponse.json({
    summary: {
      totalActive,
      webActive,
      appActive,
      newVisitors,
      returningVisitors,
    },
    breakdowns: {
      device: deviceBreakdown,
      browser: browserBreakdown,
      os: osBreakdown,
      country: countryBreakdown,
    },
    topPages,
    sessions: sessions.slice(0, 50), // Limit to 50 for performance
  });
  } catch (error: any) {
    console.error('[Analytics Realtime] Error:', error.message);
    return NextResponse.json({
      summary: { totalActive: 0, webActive: 0, appActive: 0, newVisitors: 0, returningVisitors: 0 },
      breakdowns: { device: {}, browser: {}, os: {}, country: {} },
      topPages: [],
      sessions: [],
      error: error.message,
    });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
