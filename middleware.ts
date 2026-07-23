import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ALL_KNOWN_MODULE_PAGES: Record<string, string[]> = {
  DASHBOARD_HOME: ["/dashboard"],
  SUPPORT: ["/dashboard/support"],
  ORDERS: ["/dashboard/orders"],
  MOBILE_ORDERS: ["/dashboard/mobile-orders"],
  CUSTOMERS: ["/dashboard/customers"],
  PRODUCTS: [
    "/dashboard/products",
    "/dashboard/collections"
  ],
  INVENTORY: [
    "/dashboard/inventory",
    "/dashboard/inventory/scanner",
    "/dashboard/scanner-records",
    "/dashboard/price-tags",
  ],
  LOGISTICS: ["/dashboard/logistics"],
  RETURNS_EXCHANGES: [
    "/dashboard/returns",
    "/dashboard/exchanges"
  ],
  STOREFRONT: [
    "/web-store",
    "/web-store/orders",
    "/web-store/customers",
    "/web-store/abandoned-carts",
    "/web-store/storefront",
    "/web-store/homepage",
    "/web-store/products",
    "/web-store/banners",
    "/web-store/gallery",
    "/web-store/coupons",
    "/web-store/logins",
    "/dashboard/webstore-settings/preferences",
  ],
  COMMUNITY: [
    "/dashboard/community/chat",
    "/dashboard/community",
    "/dashboard/blogs",
  ],
  MARKETING: [
    "/dashboard/marketing/seo",
    "/dashboard/marketing/analytics",
    "/dashboard/marketing/meta-pixel",
    "/dashboard/wishlist",
    "/dashboard/notifications",
    "/dashboard/marketing/discounts",
    "/dashboard/marketing/whatsapp",
    "/dashboard/marketing/email",
    "/dashboard/marketing/sms",
    "/dashboard/whatsapp-events/overview",
    "/dashboard/whatsapp-events/events",
    "/dashboard/whatsapp-events/campaign-analytics",
    "/dashboard/whatsapp-events/templates",
    "/dashboard/whatsapp-events/customer-journeys",
    "/dashboard/whatsapp-events/meta-review",
  ],
  FINANCIAL: [
    "/dashboard/payments",
    "/dashboard/payments/store-credits",
    "/dashboard/payments/refunds",
  ],
  MANUFACTURING: [
    "/dashboard/manufacturing",
    "/dashboard/manufacturing/designs",
    "/dashboard/manufacturing/samples",
    "/dashboard/manufacturing/tasks",
    "/dashboard/manufacturing/production",
    "/dashboard/manufacturing/fabric",
    "/dashboard/manufacturing/movement",
    "/dashboard/manufacturing/vendors",
    "/dashboard/manufacturing/costs",
    "/dashboard/manufacturing/knowledge-base",
    "/dashboard/manufacturing/employees",
    "/dashboard/manufacturing/reports",
  ],
  INTEGRATIONS: [
    "/dashboard/app-integration",
    "/dashboard/live-carts",
    "/dashboard/app-logins",
    "/dashboard/payments/razorpay",
  ],
  AI_SERVICES: [
    "/dashboard/ai",
    "/dashboard/ai/admin",
    "/dashboard/ai/user",
    "/dashboard/ai/training",
  ],
  SETTINGS: ["/dashboard/settings"],
  ADMIN_USERS: ["/dashboard/admin-users"],
  AUDIT_LOG: ["/dashboard/audit-log"],
  ANALYTICS: ["/dashboard/analytics"],
};

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Allow login page to load without checks to avoid redirect loop
    if (pathname === '/dashboard/login') {
      return NextResponse.next();
    }

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
      "/api/admin/orders": "ORDERS",
      "/dashboard/products": "PRODUCTS",
      "/dashboard/inventory": "INVENTORY",
      "/dashboard/customers": "CUSTOMERS",
      "/dashboard/manufacturing": "MANUFACTURING",
      "/dashboard/production": "PRODUCTION_TRACKER",
      "/dashboard/financial": "FINANCIAL",
      "/dashboard/marketing": "MARKETING",
      "/api/discounts": "MARKETING",
      "/dashboard/vendors": "VENDORS",
      "/dashboard/returns": "RETURNS_EXCHANGES",
      "/dashboard/analytics": "ANALYTICS",
      "/api/admin/analytics": "ANALYTICS",
      "/dashboard/settings": "SETTINGS",
      "/dashboard/admin-users": "ADMIN_USERS",
      "/dashboard/audit-log": "AUDIT_LOG",
      
      // Web Store CMS mappings
      "/web-store": "STOREFRONT",
      "/api/web-store": "STOREFRONT",
      "/dashboard/webstore-settings": "STOREFRONT",
      "/api/webstore-settings": "STOREFRONT",
      "/api/admin/abandoned-carts": "STOREFRONT",
      "/api/admin/mood-board": "STOREFRONT",
      
      // Admin API mappings for middleware double-guard
      "/api/admin/users": "ADMIN_USERS",
      "/api/admin/audit-logs": "ADMIN_USERS",
    };

    // Check module-specific page/API access
    const apiPageMap: Record<string, string> = {
      "/api/admin/orders": "/dashboard/orders",
      "/api/web-store/stats": "/web-store",
      "/api/web-store/orders": "/web-store/orders",
      "/api/web-store/customers": "/web-store/customers",
      "/api/web-store/banners": "/web-store/banners",
      "/api/web-store/gallery": "/web-store/gallery",
      "/api/web-store/coupons": "/web-store/coupons",
      "/api/web-store/logins": "/web-store/logins",
      "/api/webstore-settings": "/dashboard/webstore-settings/preferences",
      "/api/admin/users": "/dashboard/admin-users",
      "/api/admin/audit-logs": "/dashboard/audit-log",
      "/api/admin/abandoned-carts": "/web-store/abandoned-carts",
      "/api/admin/mood-board": "/web-store/products",
      "/api/admin/analytics": "/dashboard/analytics",
    };

    // Sort routes by length descending so that longest match runs first (e.g. /dashboard/admin-users before /dashboard)
    const sortedRoutes = Object.keys(moduleMap).sort((a, b) => b.length - a.length);

    for (const route of sortedRoutes) {
      if (pathname.startsWith(route)) {
        // Allow public GET requests on banners API
        if (pathname === "/api/web-store/banners" && req.method === "GET") {
          continue;
        }

        const permissions = (token?.permissions as any[]) || [];
        const permission = permissions.find(p => p.module === moduleMap[route]);
        
        const isApi = pathname.startsWith('/api/');
        let hasAccess = false;
        
        // 1. Run real-time check using secure internal API
        try {
          const checkUrl = new URL(`/api/admin/users/check-permissions`, req.url);
          checkUrl.searchParams.set("userId", token?.id as string);
          checkUrl.searchParams.set("module", moduleMap[route]);
          checkUrl.searchParams.set("path", pathname);
          checkUrl.searchParams.set("method", req.method);
          
          const res = await fetch(checkUrl.toString(), {
            headers: {
              "x-internal-secret": process.env.INTERNAL_API_SECRET || ""
            }
          });
          if (res.ok) {
            const data = await res.json();
            hasAccess = data.hasAccess;
          } else {
            throw new Error(`Response status: ${res.status}`);
          }
        } catch (err) {
          console.warn("Middleware real-time permissions check failed, falling back to token validation:", err);
          
          // Fallback to token permissions
          if (permission) {
            if (isApi) {
              const isWrite = ["POST", "PUT", "DELETE", "PATCH"].includes(req.method);
              if (isWrite) {
                hasAccess = req.method === "DELETE" ? permission.canDelete || permission.canEdit : permission.canEdit;
              } else {
                hasAccess = permission.canView;
              }
            } else {
              hasAccess = permission.canView;
            }

            // Enforce granular page-level check with crossing prevention
            if (hasAccess && permission.pages) {
              const allowedPages = (permission.pages as string).split(',');
              const knownPagesForModule = ALL_KNOWN_MODULE_PAGES[moduleMap[route]] || [];
              if (isApi) {
                let targetPage: string | null = null;
                for (const [apiPrefix, pageRoute] of Object.entries(apiPageMap)) {
                  if (pathname.startsWith(apiPrefix)) {
                    targetPage = pageRoute;
                    break;
                  }
                }
                if (targetPage && !allowedPages.includes(targetPage)) {
                  hasAccess = false;
                }
              } else {
                let isAllowed = false;
                for (const allowedPage of allowedPages) {
                  if (pathname === allowedPage || pathname.startsWith(allowedPage + "/")) {
                    const isCrossingIntoOtherRestrictedPage = knownPagesForModule.some(kp => 
                      kp !== allowedPage && 
                      !allowedPages.includes(kp) && 
                      (pathname === kp || pathname.startsWith(kp + "/"))
                    );
                    if (!isCrossingIntoOtherRestrictedPage) {
                      isAllowed = true;
                      break;
                    }
                  }
                }
                hasAccess = isAllowed;
              }
            }
          }
        }
        
        if (!hasAccess) {
          if (isApi) {
            return new NextResponse(
              JSON.stringify({ error: `Forbidden: Insufficient permissions for module ${moduleMap[route]}` }), 
              {
                status: 403,
                headers: { "Content-Type": "application/json" }
              }
            );
          } else {
            return NextResponse.redirect(new URL("/unauthorized", req.url));
          }
        }
        
        // Match found and verified, skip other routes
        break;
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

        // Allow public banners and gallery API GET request
        if ((pathname === '/api/web-store/banners' || pathname === '/api/web-store/gallery') && req.method === 'GET') return true;

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
    "/web-store/:path*",
    "/api/admin/:path*",
    "/api/web-store/:path*",
    "/api/payments/refund",
  ],
};
