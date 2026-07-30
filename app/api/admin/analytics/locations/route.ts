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
    const startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const endDate = to ? new Date(to) : now;

    const dateFilter = { gte: startDate, lte: endDate };
    const platformFilter = platform ? { platform } : {};

    // ─── Top Countries (from sessions with location data) ────────
    const countrySessions: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        UPPER(COALESCE(country_code, country)) AS country_code,
        COALESCE(country, country_code) AS country_name,
        COUNT(*) AS session_count,
        COUNT(DISTINCT anonymous_id) AS visitor_count
      FROM analytics_sessions
      WHERE started_at >= $1 AND started_at <= $2
        AND (country_code IS NOT NULL OR country IS NOT NULL)
        ${platform ? `AND platform = '${platform}'` : ''}
      GROUP BY UPPER(COALESCE(country_code, country)), COALESCE(country, country_code)
      ORDER BY session_count DESC
      LIMIT 30
    `, startDate, endDate);

    const totalCountrySessions = countrySessions.reduce((sum: number, c: any) => sum + Number(c.session_count), 0) || 1;

    const topCountries = countrySessions.map((c: any) => ({
      code: (c.country_code || 'XX').toUpperCase(),
      name: c.country_name || c.country_code || 'Unknown',
      sessions: Number(c.session_count),
      visitors: Number(c.visitor_count),
      share: Math.round((Number(c.session_count) / totalCountrySessions) * 100),
    }));

    // ─── Top Cities (from sessions with city data) ────────────────
    const citySessions: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        city,
        UPPER(COALESCE(country_code, country)) AS country_code,
        COUNT(*) AS session_count,
        COUNT(DISTINCT anonymous_id) AS visitor_count,
        AVG(lat) AS avg_lat,
        AVG(lng) AS avg_lng
      FROM analytics_sessions
      WHERE started_at >= $1 AND started_at <= $2
        AND city IS NOT NULL AND city != '' AND LOWER(city) != 'unknown'
        ${platform ? `AND platform = '${platform}'` : ''}
      GROUP BY city, UPPER(COALESCE(country_code, country))
      ORDER BY session_count DESC
      LIMIT 30
    `, startDate, endDate);

    const totalCitySessions = citySessions.reduce((sum: number, c: any) => sum + Number(c.session_count), 0) || 1;

    const topCities = citySessions.map((c: any) => ({
      city: c.city,
      countryCode: (c.country_code || 'XX').toUpperCase(),
      sessions: Number(c.session_count),
      visitors: Number(c.visitor_count),
      share: Math.round((Number(c.session_count) / totalCitySessions) * 100),
      lat: c.avg_lat != null ? Number(c.avg_lat) : null,
      lng: c.avg_lng != null ? Number(c.avg_lng) : null,
    }));

    // ─── Aggregated Visitor Points for Globe (historical) ─────────
    const geoPoints: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        CASE
          WHEN LENGTH(country_code) = 2 THEN UPPER(country_code)
          WHEN LOWER(country) LIKE '%india%' THEN 'IN'
          WHEN LOWER(country) LIKE '%united states%' OR LOWER(country) LIKE '%usa%' THEN 'US'
          WHEN LOWER(country) LIKE '%united kingdom%' OR LOWER(country) LIKE '%uk%' THEN 'GB'
          WHEN LENGTH(country) = 2 THEN UPPER(country)
          ELSE COALESCE(UPPER(country_code), 'IN')
        END AS country_code,
        COALESCE(country, country_code, 'India') AS country_name,
        COALESCE(city, 'Centroid') AS city,
        AVG(lat) AS avg_lat,
        AVG(lng) AS avg_lng,
        COUNT(*) AS session_count,
        COUNT(DISTINCT anonymous_id) AS visitor_count
      FROM analytics_sessions
      WHERE started_at >= $1 AND started_at <= $2
        AND (country_code IS NOT NULL OR country IS NOT NULL OR lat IS NOT NULL)
        ${platform ? `AND platform = '${platform}'` : ''}
      GROUP BY 1, 2, 3
      ORDER BY session_count DESC
      LIMIT 100
    `, startDate, endDate);

    const visitorPoints = geoPoints.map((p: any) => ({
      countryCode: (p.country_code || 'IN').toUpperCase(),
      country: p.country_name || 'India',
      city: p.city || 'Unknown',
      lat: p.avg_lat != null ? Number(p.avg_lat) : null,
      lng: p.avg_lng != null ? Number(p.avg_lng) : null,
      count: Number(p.session_count),
      visitors: Number(p.visitor_count),
    }));

    // ─── Summary Stats ───────────────────────────────────────────
    const totalWithLocation = await prisma.analyticsSession.count({
      where: {
        startedAt: dateFilter,
        ...platformFilter,
        OR: [
          { countryCode: { not: null } },
          { country: { not: null } },
        ],
      },
    });

    const totalWithoutLocation = await prisma.analyticsSession.count({
      where: {
        startedAt: dateFilter,
        ...platformFilter,
        countryCode: null,
        country: null,
      },
    });

    return NextResponse.json({
      topCountries,
      topCities,
      visitorPoints,
      summary: {
        totalWithLocation,
        totalWithoutLocation,
        uniqueCountries: topCountries.length,
        uniqueCities: topCities.length,
      },
    });
  } catch (error: any) {
    console.error('[Analytics Locations] Error:', error.message);
    return NextResponse.json({
      topCountries: [],
      topCities: [],
      visitorPoints: [],
      summary: { totalWithLocation: 0, totalWithoutLocation: 0, uniqueCountries: 0, uniqueCities: 0 },
      error: error.message,
    });
  }
}

export const GET = withAdminApiGuard(handler, { module: 'ANALYTICS', action: 'view' });
