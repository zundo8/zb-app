import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payment-status — Razorpay ready for live payments (ID + secret configured).
 */
export async function GET() {
  try {
    const creds = await resolveRazorpayCredentials();
    return NextResponse.json({
      razorpayReady: true,
      source: creds.source,
    });
  } catch {
    return NextResponse.json({
      razorpayReady: false,
      source: 'none' as const,
    });
  }
}
