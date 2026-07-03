/**
 * CORS helper — checks the incoming Origin against an allow-list
 * and returns appropriate headers. Never returns `Access-Control-Allow-Origin: *`.
 */

import { NextResponse, NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "https://zicabella.com",
  "https://www.zicabella.com",
  "https://app.zicabella.com",
];

/** Returns CORS headers for the matched origin, or empty object if origin not in allow-list. */
export function getCorsHeaders(req: Request | NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";

  // Allow requests from known origins only
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
    };
  }

  // Same-origin requests (e.g. from the Next.js app itself) won't have an Origin header
  // or the origin matches the host — allow these through without CORS headers
  return {};
}

/** Standard OPTIONS preflight handler — returns 204 with CORS headers if origin is allowed. */
export function handleCorsOptions(req: Request | NextRequest): NextResponse {
  const headers = getCorsHeaders(req);

  if (Object.keys(headers).length > 0) {
    return new NextResponse(null, { status: 204, headers });
  }

  // Origin not in allow-list — return 204 without CORS headers (browser will block)
  return new NextResponse(null, { status: 204 });
}

/** Append CORS headers to an existing NextResponse if the origin is allowed. */
export function withCors(req: Request | NextRequest, response: NextResponse): NextResponse {
  const headers = getCorsHeaders(req);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
