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

    const fetchLimit = page * limit; // mathematically correct limit to ensure we have enough items to slice at skip

    // Fetch in parallel from all applicable sources
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
    ] = await Promise.all([
      // 1. Audit Logs (Admin user actions) - relevant for system, users, unread, all
      filter === "all" || filter === "system" || filter === "users" || filter === "unread"
        ? prisma.auditLog.findMany({
            where: filter === "unread" ? { timestamp: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { timestamp: "desc" },
            include: { user: { select: { name: true, email: true, role: true } } },
          })
        : Promise.resolve([]),

      // 2. Orders (Sales) - relevant for orders, unread, all
      filter === "all" || filter === "orders" || filter === "unread"
        ? prisma.order.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
            include: { customer: { select: { name: true, email: true } } },
          })
        : Promise.resolve([]),

      // 3. Return Requests - relevant for orders, unread, all
      filter === "all" || filter === "orders" || filter === "unread"
        ? prisma.returnRequest.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
            include: { order: { include: { customer: { select: { name: true, email: true } } } } },
          })
        : Promise.resolve([]),

      // 4. Exchange Requests - relevant for orders, unread, all
      filter === "all" || filter === "orders" || filter === "unread"
        ? prisma.exchangeRequest.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
            include: { order: { include: { customer: { select: { name: true, email: true } } } } },
          })
        : Promise.resolve([]),

      // 5. Customers - relevant for users, unread, all
      filter === "all" || filter === "users" || filter === "unread"
        ? prisma.customer.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),

      // 6. Support Tickets - relevant for system, unread, all
      filter === "all" || filter === "system" || filter === "unread"
        ? prisma.supportTicket.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),

      // 7. Push Notifications Sent - relevant for system, unread, all
      filter === "all" || filter === "system" || filter === "unread"
        ? prisma.notificationSend.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),

      // 8. Barcode Scanner Records - relevant for products, unread, all
      filter === "all" || filter === "products" || filter === "unread"
        ? prisma.scanRecord.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),

      // 9. Mobile App Logins - relevant for users, unread, all
      filter === "all" || filter === "users" || filter === "unread"
        ? prisma.appLogin.findMany({
            where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
            take: fetchLimit,
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    // Map each table to a unified notification schema
    const mappedNotifications = [
      ...auditLogs.map((item) => ({
        id: item.id,
        userId: item.userId,
        action: item.action,
        module: item.module,
        targetId: item.targetId,
        metadata: item.metadata,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        timestamp: item.timestamp.toISOString(),
        user: item.user
          ? { name: item.user.name, email: item.user.email, role: item.user.role }
          : null,
      })),

      ...orders.map((item) => ({
        id: `order-${item.id}`,
        userId: item.customerId,
        action: "ORDER_PLACED",
        module: "ORDERS",
        targetId: item.id,
        metadata: {
          summary: `Order #${item.shopifyOrderId.replace("gid://shopify/Order/", "")} was placed for ${item.currency} ${item.totalPrice.toLocaleString()}. Status: ${item.status}`,
          description: `Fulfillment: ${item.fulfillmentStatus} · Payment: ${item.paymentStatus} · Type: ${item.orderType}`,
          details: item.note || undefined,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: item.createdAt.toISOString(),
        user: item.customer
          ? { name: item.customer.name, email: item.customer.email, role: "CUSTOMER" }
          : null,
      })),

      ...returnRequests.map((item) => ({
        id: `return-${item.id}`,
        userId: item.customerId,
        action: "RETURN_REQUESTED",
        module: "RETURNS_EXCHANGES",
        targetId: item.orderId,
        metadata: {
          summary: `Return requested for Order #${item.order.shopifyOrderId.replace("gid://shopify/Order/", "")}`,
          description: `Reason: ${item.reason || "Not provided"} · Est. Refund: INR ${item.estimatedRefund.toLocaleString()} · Status: ${item.status}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: item.createdAt.toISOString(),
        user: item.order.customer
          ? { name: item.order.customer.name, email: item.order.customer.email, role: "CUSTOMER" }
          : null,
      })),

      ...exchangeRequests.map((item) => ({
        id: `exchange-${item.id}`,
        userId: item.customerId,
        action: "EXCHANGE_REQUESTED",
        module: "RETURNS_EXCHANGES",
        targetId: item.orderId,
        metadata: {
          summary: `Exchange requested for Order #${item.order.shopifyOrderId.replace("gid://shopify/Order/", "")}`,
          description: `Reason: ${item.reason || "Not provided"} · Price Diff: INR ${item.priceDifference.toLocaleString()} · Status: ${item.status}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: item.createdAt.toISOString(),
        user: item.order.customer
          ? { name: item.order.customer.name, email: item.order.customer.email, role: "CUSTOMER" }
          : null,
      })),

      ...customers.map((item) => ({
        id: `cust-${item.id}`,
        userId: item.id,
        action: "CUSTOMER_SIGNUP",
        module: "CUSTOMERS",
        targetId: item.id,
        metadata: {
          summary: `New customer signup: ${item.name || item.email || "Anonymous"}`,
          description: `Email: ${item.email || "No Email"} · Phone: ${item.phone || "No Phone"} · Total Spent: INR ${item.totalSpent.toLocaleString()}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: item.createdAt.toISOString(),
        user: { name: item.name, email: item.email, role: "CUSTOMER" },
      })),

      ...supportTickets.map((item) => ({
        id: `ticket-${item.id}`,
        userId: item.customerId,
        action: "SUPPORT_TICKET_CREATED",
        module: "SUPPORT",
        targetId: item.id,
        metadata: {
          summary: `Support ticket created: "${item.subject}"`,
          description: `Status: ${item.status} · Priority: ${item.priority} · Guest Email: ${item.guestEmail || "No Email"}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: item.createdAt.toISOString(),
        user: {
          name: item.guestName || "Guest",
          email: item.guestEmail || "",
          role: "CUSTOMER",
        },
      })),

      ...pushNotifications.map((item) => ({
        id: `push-${item.id}`,
        userId: null,
        action: "PUSH_NOTIFICATION_SENT",
        module: "MARKETING",
        targetId: item.id,
        metadata: {
          summary: `Push broadcast: "${item.title}"`,
          description: `Target: ${item.targetType} · Reached: ${item.sentCount} devices · Status: ${item.status}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: (item.sentAt || item.createdAt).toISOString(),
        user: { name: "System", email: item.createdBy, role: "SUPER_ADMIN" },
      })),

      ...scanRecords.map((item) => ({
        id: `scan-${item.id}`,
        userId: null,
        action: `INVENTORY_${item.actionType}`,
        module: "INVENTORY",
        targetId: item.productId,
        metadata: {
          summary: `Stock ${item.actionType}: ${item.productTitle || "Product"}`,
          description: `Qty: ${item.quantity} · SKU: ${item.sku || "No SKU"} · Barcode: ${item.barcode || "No Barcode"} · Staff: ${item.staffName}`,
        },
        ipAddress: null,
        userAgent: null,
        timestamp: item.createdAt.toISOString(),
        user: { name: item.staffName, email: "", role: "ADMIN" },
      })),

      ...appLogins.map((item) => ({
        id: `login-${item.id}`,
        userId: null,
        action: `MOBILE_APP_LOGIN_${item.status}`,
        module: "INTEGRATIONS",
        targetId: null,
        metadata: {
          summary: `Mobile app login (${item.status}): ${item.phone}`,
          description: `IP: ${item.ip || "Unknown"} · UA: ${item.userAgent || "Unknown"}`,
        },
        ipAddress: item.ip,
        userAgent: item.userAgent,
        timestamp: item.createdAt.toISOString(),
        user: { name: item.phone, email: "", role: "CUSTOMER" },
      })),
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

    // AuditLog
    if (filter === "all" || filter === "system" || filter === "users" || filter === "unread") {
      countPromises.push(
        prisma.auditLog.count({
          where: filter === "unread" ? { timestamp: { gt: lastReadAt } } : {},
        })
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Orders, returns, exchanges
    if (filter === "all" || filter === "orders" || filter === "unread") {
      countPromises.push(
        prisma.order.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }),
        prisma.returnRequest.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }),
        prisma.exchangeRequest.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        })
      );
    } else {
      countPromises.push(Promise.resolve(0), Promise.resolve(0), Promise.resolve(0));
    }

    // Customer signups
    if (filter === "all" || filter === "users" || filter === "unread") {
      countPromises.push(
        prisma.customer.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        })
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // Support and Push broadasts
    if (filter === "all" || filter === "system" || filter === "unread") {
      countPromises.push(
        prisma.supportTicket.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        }),
        prisma.notificationSend.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        })
      );
    } else {
      countPromises.push(Promise.resolve(0), Promise.resolve(0));
    }

    // Product scan records
    if (filter === "all" || filter === "products" || filter === "unread") {
      countPromises.push(
        prisma.scanRecord.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        })
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    // App login records
    if (filter === "all" || filter === "users" || filter === "unread") {
      countPromises.push(
        prisma.appLogin.count({
          where: filter === "unread" ? { createdAt: { gt: lastReadAt } } : {},
        })
      );
    } else {
      countPromises.push(Promise.resolve(0));
    }

    const counts = await Promise.all(countPromises);
    const totalCount = counts.reduce((acc, curr) => acc + curr, 0);

    return NextResponse.json({
      notifications: paginatedNotifications,
      total: totalCount,
      page,
      limit,
      unreadCount: totalUnreadCount,
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
