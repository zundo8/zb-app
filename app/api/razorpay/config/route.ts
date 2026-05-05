import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/razorpay/config
 * Returns the public Razorpay Key ID for the app to use.
 */
export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  
  if (!keyId || keyId.includes('xxxx')) {
    return NextResponse.json({ 
      error: 'Razorpay Key ID not configured on server. Please update .env.local with real keys.',
      isConfigured: false 
    }, { status: 200 });
  }

  return NextResponse.json({ 
    keyId,
    isConfigured: true 
  });
}
