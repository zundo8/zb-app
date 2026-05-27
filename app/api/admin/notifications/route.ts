import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const page = parseInt(searchParams.get("page") || "1");
    const filter = searchParams.get("filter") || "all"; // all | unread | orders | products | users | system
    const skip = (page - 1) * limit;

    // Get last read timestamp for this user
    const readRecord = await prisma.adminNotificationRead.findUnique({
      where: { userId },
    });
    const lastReadAt = readRecord?.lastReadAt || new Date(0);

    // Build filter conditions
    const where: any = {};
    if (filter === "unread") {
      where.timestamp = { gt: lastReadAt };
    } else if (filter === "orders") {
      where.module = { in: ["ORDERS", "MOBILE_ORDERS"] };
    } else if (filter === "products") {
      where.module = { in: ["PRODUCTS", "INVENTORY"] };
    } else if (filter === "users") {
      where.module = { in: ["CUSTOMERS", "ADMIN_USERS"] };
    } else if (filter === "system") {
      where.module = { in: ["SETTINGS", "AUDIT_LOG", "INTEGRATIONS"] };
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip,
        include: {
          user: {
            select: { name: true, email: true, role: true },
          },
        },
        orderBy: { timestamp: "desc" },
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({
        where: { timestamp: { gt: lastReadAt } },
      }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      page,
      limit,
      unreadCount,
      lastReadAt: lastReadAt.toISOString(),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    // Mark all as read by updating lastReadAt to now
    await prisma.adminNotificationRead.upsert({
      where: { userId },
      update: { lastReadAt: new Date() },
      create: { userId, lastReadAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
