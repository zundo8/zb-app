import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/razorpay/config
 * Returns the public Razorpay Key ID for the app to use.
 * Tries env vars first, then DB fallback.
 */
export async function GET() {
  // Try env vars first
  let keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  
  // Check if key is valid (not placeholder)
  if (keyId && !keyId.includes('xxxx') && keyId.startsWith('rzp_')) {
    return NextResponse.json({ 
      keyId,
      isConfigured: true 
    });
  }

  // DB fallback
  try {
    const shop = await prisma.shop.findFirst({
      select: { razorpayKeyId: true }
    });
    
    if (shop?.razorpayKeyId && shop.razorpayKeyId.startsWith('rzp_')) {
      return NextResponse.json({ 
        keyId: shop.razorpayKeyId,
        isConfigured: true 
      });
    }
  } catch (e) {
    console.error('[Razorpay Config] DB lookup error:', e);
  }

  return NextResponse.json({ 
    error: 'Razorpay setup incomplete. Real payments require RAZORPAY_KEY_ID to be set in .env.local or Infrastructure settings.',
    isConfigured: false,
    mockAllowed: true, // Allow mobile app to enter mock mode if keys are missing
    setupUrl: 'https://app.zicabella.com/dashboard/settings'
  }, { status: 200 });
}
