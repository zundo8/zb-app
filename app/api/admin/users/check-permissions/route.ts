import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const moduleName = searchParams.get("module");
    const path = searchParams.get("path");
    const method = searchParams.get("method") || "GET";

    const secret = req.headers.get("x-internal-secret");
    if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ hasAccess: false, error: "Unauthorized internal call" }, { status: 401 });
    }

    if (!userId || !moduleName) {
      return NextResponse.json({ hasAccess: false });
    }

    const permission = await prisma.permission.findFirst({
      where: { userId, module: moduleName as any }
    });

    if (!permission || !permission.canView) {
      return NextResponse.json({ hasAccess: false });
    }

    const isApi = path?.startsWith('/api/');
    if (isApi) {
      const isWrite = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
      if (isWrite) {
        const canEdit = method === "DELETE" ? permission.canDelete || permission.canEdit : permission.canEdit;
        if (!canEdit) {
          return NextResponse.json({ hasAccess: false });
        }
      }
    }

    if (permission.pages && path && !isApi) {
      const allowedPages = permission.pages.split(',');
      const hasPageAccess = allowedPages.some(allowedPage => 
        path === allowedPage || path.startsWith(allowedPage + "/")
      );
      if (!hasPageAccess) {
        return NextResponse.json({ hasAccess: false });
      }
    }

    return NextResponse.json({ hasAccess: true });
  } catch (error: any) {
    console.error("[check-permissions API] Error:", error);
    return NextResponse.json({ hasAccess: false, error: error.message }, { status: 500 });
  }
}
