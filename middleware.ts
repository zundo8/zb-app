import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must match the HMAC function in the login API
function makeSessionToken(): string {
  // Edge runtime version
  return process.env.ADMIN_SESSION_TOKEN || 'MISSING_SECRET_KEY_REJECT_ALL';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for the login page itself to avoid redirect loop
  if (pathname === '/dashboard/login') return NextResponse.next();
  if (pathname === '/api/admin/login') return NextResponse.next();

  // Allow public API routes for the React Native app (no admin session needed)
  if (pathname.startsWith('/api/app/')) return NextResponse.next();

  // Paths to protect — dashboard pages and admin API
  const isAdminPath = pathname.startsWith('/dashboard');
  const isAdminApi  = pathname.startsWith('/api/admin') || pathname === '/api/payments/refund';

  if (isAdminPath || isAdminApi) {
    const sessionToken = request.cookies.get('admin_session')?.value;
    const validToken   = process.env.ADMIN_SESSION_TOKEN;

    // Production: no debug logging for security

    // MANDATORY AUTH: Fail if session token is missing or incorrect
    if (!validToken || sessionToken !== validToken) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/dashboard/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/admin/:path*',
    '/api/payments/refund',
  ],
};
