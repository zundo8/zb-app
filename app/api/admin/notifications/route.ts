import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

interface OrderItemRef {
  id?: string;
  internalOrderNumber?: string | null;
  shopifyOrderName?: string | null;
  shopifyOrderId?: string | null;
  customer?: { name?: string | null; email?: string | null } | null;
}

interface AuditLogItem {
  id: string;
  userId?: string | null;
  action?: string | null;
  module?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp?: Date | string | null;
  createdAt?: Date | string | null;
  user?: { name?: string | null; email?: string | null; role?: string | null } | null;
}

interface OrderItem extends OrderItemRef {
  id: string;
  customerId?: string | null;
  currency?: string | null;
  totalPrice?: number | null;
  status?: string | null;
  fulfillmentStatus?: string | null;
  paymentStatus?: string | null;
  orderType?: string | null;
  note?: string | null;
  createdAt?: Date | string | null;
}

interface ReturnRequestItem {
  id: string;
  customerId?: string | null;
  orderId?: string | null;
  reason?: string | null;
  estimatedRefund?: number | null;
  status?: string | null;
  createdAt?: Date | string | null;
  order?: OrderItem | null;
}

interface ExchangeRequestItem {
  id: string;
  customerId?: string | null;
  orderId?: string | null;
  reason?: string | null;
  priceDifference?: number | null;
  status?: string | null;
  createdAt?: Date | string | null;
  order?: OrderItem | null;
}

interface CustomerItem {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  totalSpent?: number | null;
  createdAt?: Date | string | null;
}

interface SupportTicketItem {
  id: string;
  customerId?: string | null;
  subject?: string | null;
  status?: string | null;
  priority?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  createdAt?: Date | string | null;
}

interface NotificationSendItem {
  id: string;
  title?: string | null;
  targetType?: string | null;
  sentCount?: number | null;
  status?: string | null;
  createdBy?: string | null;
  sentAt?: Date | string | null;
  createdAt?: Date | string | null;
}

interface ScanRecordItem {
  id: string;
  actionType?: string | null;
  productId?: string | null;
  productTitle?: string | null;
  quantity?: number | null;
  sku?: string | null;
  barcode?: string | null;
  staffName?: string | null;
  createdAt?: Date | string | null;
}

interface AppLoginItem {
  id: string;
  status?: string | null;
  phone?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: Date | string | null;
}

const displayOrderNo = (o: OrderItemRef | null | undefined) =>
  (o?.internalOrderNumber || o?.shopifyOrderName || o?.shopifyOrderId || "")
    .replace("gid://shopify/Order/", "") || (o?.id ? `#${String(o.id).slice(-6).toUpperCase()}` : "#N/A");

const safeIsoString = (val: unknown) => {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val as string | number | Date);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as { id: string }).id;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const page = parseInt(searchParams.get("page") || "1");
    const filter = searchParams.get("filter") || "all"; // all | unread | orders | products | users | system
    const skip = (page - 1) * limit;

    // Get last read timestamp for this user
    const readRecord = await prisma.adminNotificationRead.findUnique({
      where: { userId },
    }).catch(() => null);
    const lastReadAt = readRecord?.lastReadAt || new Date(0);

    const fetchLimit = page * limit; // Safe window to collect enough items for sorting & slicing at skip

    // Fetch in parallel from all applicable sources with error isolation per source
    const [
      auditLogs,
      orders,
      returnRequests,
      exchangeRequests,
      customers,
      supportTickets,
      pushNotifications,
      scanRecords,
      appLogins,
      cronLogs,
    ] = await Promise.all([
      // 1. Audit Logs (Admin user actions) - relevant for system, users, unread, all
      filter === "all" || filter === "system" || filter === "users" || filter === "unread"
        ? prisma.auditLog.findMany({
            where: filter === "unread" ? { timestamp: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { timestamp: "desc" },
            include: { user: { select: { name: true, email: true, role: true } } },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching auditLog:", err);
            return [] as AuditLogItem[];
          })
        : Promise.resolve([] as AuditLogItem[]),

      // 2. Orders (Sales) - relevant for orders, unread, all
      filter === "all" || filter === "orders" || filter === "unread"
        ? prisma.order.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
            include: { customer: { select: { name: true, email: true } } },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching order:", err);
            return [] as OrderItem[];
          })
        : Promise.resolve([] as OrderItem[]),

      // 3. Return Requests - relevant for orders, unread, all
      filter === "all" || filter === "orders" || filter === "unread"
        ? prisma.returnRequest.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
            include: { order: { include: { customer: { select: { name: true, email: true } } } } },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching returnRequest:", err);
            return [] as ReturnRequestItem[];
          })
        : Promise.resolve([] as ReturnRequestItem[]),

      // 4. Exchange Requests - relevant for orders, unread, all
      filter === "all" || filter === "orders" || filter === "unread"
        ? prisma.exchangeRequest.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
            include: { order: { include: { customer: { select: { name: true, email: true } } } } },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching exchangeRequest:", err);
            return [] as ExchangeRequestItem[];
          })
        : Promise.resolve([] as ExchangeRequestItem[]),

      // 5. Customers - relevant for users, unread, all
      filter === "all" || filter === "users" || filter === "unread"
        ? prisma.customer.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching customer:", err);
            return [] as CustomerItem[];
          })
        : Promise.resolve([] as CustomerItem[]),

      // 6. Support Tickets - relevant for system, unread, all
      filter === "all" || filter === "system" || filter === "unread"
        ? prisma.supportTicket.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching supportTicket:", err);
            return [] as SupportTicketItem[];
          })
        : Promise.resolve([] as SupportTicketItem[]),

      // 7. Push Notifications Sent - relevant for system, unread, all
      filter === "all" || filter === "system" || filter === "unread"
        ? prisma.notificationSend.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching notificationSend:", err);
            return [] as NotificationSendItem[];
          })
        : Promise.resolve([] as NotificationSendItem[]),

      // 8. Barcode Scanner Records - relevant for products, unread, all
      filter === "all" || filter === "products" || filter === "unread"
        ? prisma.scanRecord.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching scanRecord:", err);
            return [] as ScanRecordItem[];
          })
        : Promise.resolve([] as ScanRecordItem[]),

      // 9. Mobile App Logins - relevant for users, unread, all
      filter === "all" || filter === "users" || filter === "unread"
        ? prisma.appLogin.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching appLogin:", err);
            return [] as AppLoginItem[];
          })
        : Promise.resolve([] as AppLoginItem[]),

      // 10. Cron Health Pings (Dead-Man's-Switch) - relevant for system, unread, all
      filter === "all" || filter === "system" || filter === "unread"
        ? prisma.syncLog.findMany({
            where: {
              action: { in: ["CRON_PING_ORDER_SYNC", "CRON_PING_WHATSAPP_SCHEDULER"] }
            },
            take: 10,
            orderBy: { createdAt: "desc" }
          }).catch((err: unknown) => {
            console.error("[Notifications API] Error fetching cron syncLogs:", err);
            return [];
          })
        : Promise.resolve([]),
    ]);

    // Check for stale cron pings (> 30 minutes)
    const cronWarnings: any[] = [];
    if (cronLogs && Array.isArray(cronLogs)) {
      const now = Date.now();
      const thirtyMinMs = 30 * 60 * 1000;

      const lastOrderSync = cronLogs.find((l: any) => l.action === "CRON_PING_ORDER_SYNC");
      if (!lastOrderSync || now - new Date(lastOrderSync.createdAt).getTime() > thirtyMinMs) {
        const ageMin = lastOrderSync ? Math.floor((now - new Date(lastOrderSync.createdAt).getTime()) / 60000) : null;
        cronWarnings.push({
          id: "cron-alert-order-sync",
          userId: null,
          action: "CRON_HEALTH_WARNING",
          module: "SYSTEM",
          targetId: "order-sync",
          metadata: {
            summary: "⚠️ Order Sync Scheduler Warning",
            description: ageMin ? `No ping received for ${ageMin} minutes (threshold: 30 min). Check GitHub Actions.` : "No order sync ping recorded yet. Check GitHub Actions.",
          },
          ipAddress: null,
          userAgent: null,
          timestamp: new Date().toISOString(),
          user: { name: "System Watchdog", email: "system@zicabella.com", role: "SUPER_ADMIN" },
        });
      }

      const lastWhatsApp = cronLogs.find((l: any) => l.action === "CRON_PING_WHATSAPP_SCHEDULER");
      if (!lastWhatsApp || now - new Date(lastWhatsApp.createdAt).getTime() > thirtyMinMs) {
        const ageMin = lastWhatsApp ? Math.floor((now - new Date(lastWhatsApp.createdAt).getTime()) / 60000) : null;
        cronWarnings.push({
          id: "cron-alert-whatsapp-scheduler",
          userId: null,
          action: "CRON_HEALTH_WARNING",
          module: "SYSTEM",
          targetId: "whatsapp-scheduler",
          metadata: {
            summary: "⚠️ WhatsApp Scheduler Warning",
            description: ageMin ? `No ping received for ${ageMin} minutes (threshold: 30 min). Check GitHub Actions.` : "No WhatsApp scheduler ping recorded yet. Check GitHub Actions.",
          },
          ipAddress: null,
          userAgent: null,
          timestamp: new Date().toISOString(),
          user: { name: "System Watchdog", email: "system@zicabella.com", role: "SUPER_ADMIN" },
        });
      }
    }

    // Map each table to a unified notification schema with complete null-safety
    const mappedNotifications = [
      ...(auditLogs as AuditLogItem[]).map((item) => ({
        id: item.id,
        userId: item.userId ?? null,
        action: item.action ?? "AUDIT_LOG",
        module: item.module ?? "SYSTEM",
        targetId: item.targetId ?? null,
        metadata: item.metadata ?? null,
        ipAddress: item.ipAddress ?? null,
        userAgent: item.userAgent ?? null,
        timestamp: safeIsoString(item.timestamp || item.createdAt),
        user: item.user
          ? { name: item.user.name ?? null, email: item.user.email ?? null, role: item.user.role ?? "ADMIN" }
          : null,
      })),

      ...(orders as OrderItem[]).map((item) => ({
        id: `order-${item.id}`,
        userId: item.customerId ?? null,
        action: "ORDER_PLACED",
        module: "ORDERS",
        targetId: item.id,
        metadata: {
          summary: `Order ${displayOrderNo(item)} was placed for ${item.currency ?? "INR"} ${(item.totalPrice ?? 0).toLocaleString()}. Status: ${item.status ?? "UNKNOWN"}`,
          description: `Fulfillment: ${item.fulfillmentStatus ?? "unfulfilled"} · Payment: ${item.paymentStatus ?? "pending"} · Type: ${item.orderType ?? "webstore"}`,
          details: item.note || undefined,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.createdAt),
        user: item.customer
          ? { name: item.customer.name ?? null, email: item.customer.email ?? null, role: "CUSTOMER" }
          : null,
      })),

      ...(returnRequests as ReturnRequestItem[]).map((item) => ({
        id: `return-${item.id}`,
        userId: item.customerId ?? null,
        action: "RETURN_REQUESTED",
        module: "RETURNS_EXCHANGES",
        targetId: item.orderId ?? null,
        metadata: {
          summary: `Return requested for Order ${displayOrderNo(item.order)}`,
          description: `Reason: ${item.reason || "Not provided"} · Est. Refund: INR ${(item.estimatedRefund ?? 0).toLocaleString()} · Status: ${item.status ?? "PENDING"}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.createdAt),
        user: item.order?.customer
          ? { name: item.order.customer.name ?? null, email: item.order.customer.email ?? null, role: "CUSTOMER" }
          : null,
      })),

      ...(exchangeRequests as ExchangeRequestItem[]).map((item) => ({
        id: `exchange-${item.id}`,
        userId: item.customerId ?? null,
        action: "EXCHANGE_REQUESTED",
        module: "RETURNS_EXCHANGES",
        targetId: item.orderId ?? null,
        metadata: {
          summary: `Exchange requested for Order ${displayOrderNo(item.order)}`,
          description: `Reason: ${item.reason || "Not provided"} · Price Diff: INR ${(item.priceDifference ?? 0).toLocaleString()} · Status: ${item.status ?? "PENDING"}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.createdAt),
        user: item.order?.customer
          ? { name: item.order.customer.name ?? null, email: item.order.customer.email ?? null, role: "CUSTOMER" }
          : null,
      })),

      ...(customers as CustomerItem[]).map((item) => ({
        id: `cust-${item.id}`,
        userId: item.id,
        action: "CUSTOMER_SIGNUP",
        module: "CUSTOMERS",
        targetId: item.id,
        metadata: {
          summary: `New customer signup: ${item.name || item.email || "Anonymous"}`,
          description: `Email: ${item.email || "No Email"} · Phone: ${item.phone || "No Phone"} · Total Spent: INR ${(item.totalSpent ?? 0).toLocaleString()}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.createdAt),
        user: { name: item.name ?? null, email: item.email ?? null, role: "CUSTOMER" },
      })),

      ...(supportTickets as SupportTicketItem[]).map((item) => ({
        id: `ticket-${item.id}`,
        userId: item.customerId ?? null,
        action: "SUPPORT_TICKET_CREATED",
        module: "SUPPORT",
        targetId: item.id,
        metadata: {
          summary: `Support ticket created: "${item.subject || "No Subject"}"`,
          description: `Status: ${item.status ?? "OPEN"} · Priority: ${item.priority ?? "NORMAL"} · Guest Email: ${item.guestEmail || "No Email"}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.createdAt),
        user: {
          name: item.guestName || "Guest",
          email: item.guestEmail || "",
          role: "CUSTOMER",
        },
      })),

      ...(pushNotifications as NotificationSendItem[]).map((item) => ({
        id: `push-${item.id}`,
        userId: null,
        action: "PUSH_NOTIFICATION_SENT",
        module: "MARKETING",
        targetId: item.id,
        metadata: {
          summary: `Push broadcast: "${item.title || "Notification"}"`,
          description: `Target: ${item.targetType ?? "ALL"} · Reached: ${(item.sentCount ?? 0).toLocaleString()} devices · Status: ${item.status ?? "SENT"}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.sentAt || item.createdAt),
        user: { name: "System", email: item.createdBy || "", role: "SUPER_ADMIN" },
      })),

      ...(scanRecords as ScanRecordItem[]).map((item) => ({
        id: `scan-${item.id}`,
        userId: null,
        action: `INVENTORY_${item.actionType ?? "SCAN"}`,
        module: "INVENTORY",
        targetId: item.productId ?? null,
        metadata: {
          summary: `Stock ${item.actionType ?? "Update"}: ${item.productTitle || "Product"}`,
          description: `Qty: ${(item.quantity ?? 0).toLocaleString()} · SKU: ${item.sku || "No SKU"} · Barcode: ${item.barcode || "No Barcode"} · Staff: ${item.staffName || "Staff"}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: safeIsoString(item.createdAt),
        user: { name: item.staffName || "Staff", email: "", role: "ADMIN" },
      })),

      ...(appLogins as AppLoginItem[]).map((item) => ({
        id: `login-${item.id}`,
        userId: null,
        action: `MOBILE_APP_LOGIN_${item.status ?? "SUCCESS"}`,
        module: "INTEGRATIONS",
        targetId: null,
        metadata: {
          summary: `Mobile app login (${item.status ?? "SUCCESS"}): ${item.phone || "Unknown"}`,
          description: `IP: ${item.ip || "Unknown"} · UA: ${item.userAgent || "Unknown"}`,
        },
        ipAddress: item.ip ?? null,
        userAgent: item.userAgent ?? null,
        timestamp: safeIsoString(item.createdAt),
        user: { name: item.phone || "User", email: "", role: "CUSTOMER" },
      })),

      ...cronWarnings,
    ];

    // Sort all combined notifications by timestamp descending
    mappedNotifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Compute slice for pagination
    const paginatedNotifications = mappedNotifications.slice(skip, skip + limit);

    // Count all unread events (created after lastReadAt) across the applicable filters
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
      prisma.auditLog.count({ where: { timestamp: { gt: lastReadAt } } }).catch(() => 0),
      prisma.order.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.returnRequest.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.exchangeRequest.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.customer.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.supportTicket.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.notificationSend.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.scanRecord.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
      prisma.appLogin.count({ where: { createdAt: { gt: lastReadAt } } }).catch(() => 0),
    ]);

    const totalUnreadCount =
      auditUnread +
      orderUnread +
      returnUnread +
      exchangeUnread +
      customerUnread +
      ticketUnread +
      pushUnread +
      scanUnread +
      loginUnread;

    // Get total count matching current filter
    const countPromises: Promise<number>[] = [];

    // AuditLog (system/users/all/unread)
    if (filter === "all" || filter === "system" || filter === "users" || filter === "unread") {
      countPromises.push(
        prisma.auditLog.count({
          where: filter === "unread" ? { timestamp: { gt: lastReadAt } } : {},
        }).catch(() => 0)
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Orders, returns, exchanges (orders/all/unread)
    if (filter === "all" || filter === "orders" || filter === "unread") {
      countPromises.push(
        prisma.order.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0),
        prisma.returnRequest.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0),
        prisma.exchangeRequest.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0)
      );
    } else {
      countPromises.push(Promise.resolve(0), Promise.resolve(0), Promise.resolve(0));
    }

    // Customer signups (users/all/unread)
    if (filter === "all" || filter === "users" || filter === "unread") {
      countPromises.push(
        prisma.customer.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0)
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Support and Push broadasts (system/all/unread)
    if (filter === "all" || filter === "system" || filter === "unread") {
      countPromises.push(
        prisma.supportTicket.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0),
        prisma.notificationSend.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0)
      );
    } else {
      countPromises.push(Promise.resolve(0), Promise.resolve(0));
    }

    // Product scan records (products/all/unread)
    if (filter === "all" || filter === "products" || filter === "unread") {
      countPromises.push(
        prisma.scanRecord.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0)
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // App login records (users/all/unread)
    if (filter === "all" || filter === "users" || filter === "unread") {
      countPromises.push(
        prisma.appLogin.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }).catch(() => 0)
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    const counts = await Promise.all(countPromises);
    const totalCount = counts.reduce((acc: number, curr: number) => acc + curr, 0);

    return NextResponse.json({
      notifications: paginatedNotifications,
      total: totalCount,
      page,
      limit,
      hasMore: skip + limit < totalCount,
      unreadCount: totalUnreadCount,
      lastReadAt: lastReadAt.toISOString(),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST() {
  try {
    const session = await requireAuth();
    const userId = (session.user as { id: string }).id;

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
