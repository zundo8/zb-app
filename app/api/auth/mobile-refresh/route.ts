import { NextResponse } from 'next/server';
import { verifyAppToken, signAccessToken, signRefreshToken } from '@/lib/appAuth';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/mobile-refresh
 * Accepts a refresh token and returns a new access + refresh token pair.
 * Refresh tokens are single-use (rotated on each call).
 * Token version is validated against the DB to support server-side revocation.
 */
export async function POST(req: Request) {
  // Rate limit: 30 requests per minute per IP
  const rateLimitResult = await checkRateLimit(req, 'auth-mobile-refresh', {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { refreshToken } = body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json(
        { error: 'refreshToken is required' },
        { status: 400 }
      );
    }

    // 1. Verify the refresh token
    let payload;
    try {
      payload = verifyAppToken(refreshToken);
    } catch (err: any) {
      const message = err?.message === 'jwt expired' ? 'Refresh token expired' : 'Invalid refresh token';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // 2. Ensure it's actually a refresh token
    if (payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid token type. Expected refresh token.' },
        { status: 401 }
      );
    }

    // 3. Look up customer and validate token version
    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      select: {
        id: true,
        tokenVersion: true,
        email: true,
        phone: true,
        name: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 401 });
    }

    // Token version check — if the stored version is higher, the token has been revoked
    if (
      payload.tokenVersion !== undefined &&
      payload.tokenVersion < customer.tokenVersion
    ) {
      return NextResponse.json(
        { error: 'Session revoked. Please log in again.' },
        { status: 401 }
      );
    }

    // 4. Issue new token pair (rotation)
    const tokenPayload = {
      customerId: customer.id,
      customerEmail: customer.email ?? null,
      customerPhone: customer.phone ?? null,
      tokenVersion: customer.tokenVersion,
    };

    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    return NextResponse.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (error: any) {
    console.error('[Mobile Refresh] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Token refresh failed. Please try again.' },
      { status: 500 }
    );
  }
}
