import { NextResponse } from 'next/server';

// Force this route to always be dynamic (never cached/static)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Lightweight health check endpoint for DigitalOcean App Platform readiness probes.
 * Returns 200 immediately without touching the database or any external services.
 * Configure your DO app spec to use: HTTP health check path = /api/health
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
