import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Requires standard authentication to get lists for dropdown assignment selectors
    await requireAuth();

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          in: ["ADMIN", "SUPER_ADMIN"]
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(users);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
