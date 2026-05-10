import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payment-status
 * Returns full Razorpay readiness status including key details and mode.
 */
export async function GET() {
  try {
    const creds = await resolveRazorpayCredentials();
    const isLive = creds.key_id.startsWith('rzp_live_');
    const isTest = creds.key_id.startsWith('rzp_test_');

    return NextResponse.json({
      razorpayReady: true,
      source: creds.source,
      mode: isLive ? 'live' : isTest ? 'test' : 'unknown',
      keyPrefix: creds.key_id.slice(0, 12) + '...',
    });
  } catch (err: any) {
    return NextResponse.json({
      razorpayReady: false,
      source: 'none' as const,
      mode: 'none',
      error: err?.message || 'Not configured',
    });
  }
}
