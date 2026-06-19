import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Allow webhook routes through without auth (Meta WhatsApp, Shopify, etc.)
    if (pathname.startsWith('/api/webhooks')) {
      return NextResponse.next();
    }

    // Allow public API routes for the React Native app
    if (pathname.startsWith('/api/app/')) return NextResponse.next();

    // CSRF protection for mutation routes (POST, PUT, DELETE) on admin APIs
    if (["POST", "PUT", "DELETE"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const referer = req.headers.get("referer");
      const host = req.headers.get("host") || "";

      if (process.env.NODE_ENV === "production") {
        if (origin) {
          try {
            const originHost = new URL(origin).host;
            if (originHost !== host) {
              return new NextResponse(JSON.stringify({ error: "CSRF validation failed: Origin mismatch" }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
              });
            }
          } catch {
            return new NextResponse(JSON.stringify({ error: "CSRF validation failed: Invalid Origin" }), {
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }
        } else if (referer) {
          try {
            const refererHost = new URL(referer).host;
            if (refererHost !== host) {
              return new NextResponse(JSON.stringify({ error: "CSRF validation failed: Referer mismatch" }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
              });
            }
          } catch {
            return new NextResponse(JSON.stringify({ error: "CSRF validation failed: Invalid Referer" }), {
              status: 403,
              headers: { "Content-Type": "application/json" }
            });
          }
        } else {
          return new NextResponse(JSON.stringify({ error: "CSRF validation failed: Missing origin/referer headers" }), {
            status: 403,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    // Super Admin bypasses all checks
    if (token?.role === "SUPER_ADMIN") return NextResponse.next();

    // Map pathnames to modules for RBAC
    const moduleMap: Record<string, string> = {
      "/dashboard/orders": "ORDERS",
      "/dashboard/products": "PRODUCTS",
      "/dashboard/inventory": "INVENTORY",
      "/dashboard/customers": "CUSTOMERS",
      "/dashboard/manufacturing": "MANUFACTURING",
      "/dashboard/production": "PRODUCTION_TRACKER",
      "/dashboard/financial": "FINANCIAL",
      "/dashboard/marketing": "MARKETING",
      "/dashboard/vendors": "VENDORS",
      "/dashboard/returns": "RETURNS",
      "/dashboard/analytics": "ANALYTICS",
      "/dashboard/settings": "SETTINGS",
      "/dashboard/admin-users": "ADMIN_USERS",
      "/dashboard/audit-log": "AUDIT_LOG",
    };

    // Check module-specific page access
    for (const [route, moduleName] of Object.entries(moduleMap)) {
      if (pathname.startsWith(route)) {
        const permissions = (token?.permissions as any[]) || [];
        const permission = permissions.find(p => p.module === moduleName);
        if (!permission || !permission.canView) {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
      }
    }

    // Protect Super Admin only pages
    if (pathname.startsWith('/dashboard/admin-users') || pathname.startsWith('/dashboard/audit-log')) {
      if (token?.role !== 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Skip auth for login page to avoid redirect loop
        if (pathname === '/dashboard/login') return true;
        
        // Allow public app APIs
        if (pathname.startsWith('/api/app/')) return true;

        const role = token?.role as string;
        const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

        return !!token && isAdmin;
      },
    },
    pages: {
      signIn: "/dashboard/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/admin/:path*",
    "/api/payments/refund",
  ],
};
