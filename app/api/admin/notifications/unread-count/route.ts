import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    const readRecord = await prisma.adminNotificationRead.findUnique({
      where: { userId },
    });
    const lastReadAt = readRecord?.lastReadAt || new Date(0);

    const unreadCount = await prisma.auditLog.count({
      where: { timestamp: { gt: lastReadAt } },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    return handleAuthError(error);
  }
}
