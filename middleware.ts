import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Allow public API routes for the React Native app
    if (pathname.startsWith('/api/app/')) return NextResponse.next();

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
