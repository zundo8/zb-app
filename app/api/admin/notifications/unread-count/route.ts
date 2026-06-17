import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    const readRecord = await prisma.adminNotificationRead.findUnique({
      where: { userId },
    });
    const lastReadAt = readRecord?.lastReadAt || new Date(0);

    // Count all unread events across all systems
    const [
      auditUnread,
      orderUnread,
      returnUnread,
      exchangeUnread,
      customerUnread,
      ticketUnread,
      pushUnread,
      scanUnread,
      loginUnread,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { timestamp: { gt: lastReadAt } } }),
      prisma.order.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.returnRequest.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.exchangeRequest.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.customer.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.supportTicket.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.notificationSend.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.scanRecord.count({ where: { createdAt: { gt: lastReadAt } } }),
      prisma.appLogin.count({ where: { createdAt: { gt: lastReadAt } } }),
    ]);

    const unreadCount =
      auditUnread +
      orderUnread +
      returnUnread +
      exchangeUnread +
      customerUnread +
      ticketUnread +
      pushUnread +
      scanUnread +
      loginUnread;

    return NextResponse.json({ unreadCount });
  } catch (error) {
    return handleAuthError(error);
  }
}
