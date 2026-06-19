import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { Module } from "@prisma/client";

export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Verifies that the user is authenticated.
 * Throws 401 if not.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error("401");
  }
  return session;
}

/**
 * Verifies that the user is a Super Admin.
 * Throws 403 if not.
 */
export async function requireSuperAdmin() {
  const session = await requireAuth();
  if ((session.user as any).role !== "SUPER_ADMIN") {
    throw new Error("403");
  }
  return session;
}

/**
 * Verifies that the user has the required permission for a module.
 * Super Admins bypass all checks.
 */
export async function requirePermission(module: Module, action: "view" | "edit" | "delete") {
  const session = await requireAuth();
  const user = session.user as any;

  // Super Admin bypass
  if (user.role === "SUPER_ADMIN") return session;

  const permissions = user.permissions || [];
  const permission = permissions.find((p: any) => p.module === module);

  if (!permission) throw new Error("403");

  if (action === "view" && !permission.canView) throw new Error("403");
  if (action === "edit" && !permission.canEdit) throw new Error("403");
  if (action === "delete" && !permission.canDelete) throw new Error("403");

  return session;
}

/**
 * Standard error handler for RBAC utility throws.
 */
export function handleAuthError(error: any) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "401") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "403") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (process.env.NODE_ENV === "development") {
    console.error("RBAC Error:", error);
  } else {
    console.error("RBAC Error:", message);
  }
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
