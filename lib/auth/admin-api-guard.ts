import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

type AdminApiHandler = (
  req: Request,
  context: { params: any; session: any }
) => Promise<NextResponse> | NextResponse;

interface GuardOptions {
  /** Optional module check (e.g. "MARKETING", "ORDERS", etc.) */
  module?: string;
  /** Optional action check ("view" | "edit" | "delete") */
  action?: "view" | "edit" | "delete";
  /** Optional Zod schema to validate request body for POST/PUT/PATCH methods */
  schema?: z.ZodSchema<any>;
}

export function withAdminApiGuard(
  handler: AdminApiHandler,
  options: GuardOptions = {}
) {
  return async (req: Request, context: any) => {
    try {
      // 1. Session & Auth check
      const session = await getServerSession(authOptions);
      if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const role = (session.user as any).role;
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // 2. RBAC check (if module/action specified and role is not SUPER_ADMIN)
      if (options.module && options.action && role !== "SUPER_ADMIN") {
        const permissions = (session.user as any).permissions || [];
        const permission = permissions.find((p: any) => p.module === options.module);
        if (!permission) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (options.action === "view" && !permission.canView) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (options.action === "edit" && !permission.canEdit) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (options.action === "delete" && !permission.canDelete) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // 3. Rate limiting check (100 req/min)
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";
      
      const { allowed } = await rateLimit(ip, { maxRequests: 100, windowMs: 60_000 });
      if (!allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }

      // 4. Request body schema validation (if schema provided and method is mutation)
      if (options.schema && ["POST", "PUT", "PATCH"].includes(req.method)) {
        try {
          const reqClone = req.clone();
          const body = await reqClone.json();
          const parsed = options.schema.safeParse(body);
          if (!parsed.success) {
            return NextResponse.json(
              { error: "Invalid request payload", details: parsed.error.format() },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }
      }

      // Pass context with session
      return await handler(req, { ...context, session });
    } catch (error: any) {
      console.error("[ADMIN_API_GUARD_ERROR]:", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}
