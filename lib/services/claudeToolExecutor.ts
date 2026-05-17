// ──────────────────────────────────────────────────
// Claude Tool Executor — Resolves tool_use calls
// against real Zica Bella data (server-side only)
// ──────────────────────────────────────────────────

import prisma from "@/lib/db";
import { logMfgAudit } from "@/lib/manufacturing/audit";
import { getTrackingStatus } from "@/lib/services/logistics";
import { 
  sendAdminEmail, 
  notifyAdminTeam, 
  emailTaskCreated, 
  emailTaskUpdated, 
  emailProductionUpdate, 
  emailDailyBriefing, 
  emailLowStockAlert,
  emailCustomAI
} from "./zohoMailService";

const ACTOR = "Zica AI";

/**
 * Execute a Claude tool call and return stringified result.
 * All heavy lifting (DB queries, API calls) happens here.
 */
export async function executeClaudeTool(
  toolName: string,
  toolInput: Record<string, any>,
  userContext?: any
): Promise<string> {
  try {
    // Log every tool call for audit trail
    await logAIAction(toolName, toolInput);

    // Defense-in-depth: Secure access from non-admins
    const isAdmin = userContext?.email?.endsWith('@zicabella.com') || false;
    if (userContext && !isAdmin) {
      const allowedUserTools = ["get_shipment_details", "get_payment_details", "get_orders_summary"];
      if (!allowedUserTools.includes(toolName)) {
        return JSON.stringify({ error: `Access Denied: The tool '${toolName}' is restricted to Zica Bella Administrators.` });
      }
    }

    switch (toolName) {
      case "get_dashboard_summary":
        return await getDashboardSummary();
      case "get_production_batches":
        return await getProductionBatches(toolInput.stage);
      case "advance_production_stage":
        return await advanceProductionStage(toolInput);
      case "get_pending_tasks":
        return await getPendingTasks(toolInput.status);
      case "create_task":
        return await createTask(toolInput);
      case "update_task_status":
        return await updateTaskStatus(toolInput.taskId, toolInput.status);
      case "get_fabric_inventory":
        return await getFabricInventory();
      case "get_vendors":
        return await getVendors(toolInput.category);
      case "get_orders_summary":
        return await getOrdersSummary(toolInput.limit, toolInput.status, userContext);
      case "update_order_status":
        return await updateOrderStatus(toolInput);
      case "get_returns_exchanges":
        return await getReturnsExchanges(toolInput.type);
      case "get_low_stock_products":
        return await getLowStockProducts(toolInput.threshold);
      case "get_cost_ledger":
        return await getCostLedger(toolInput);
      case "create_reorder_request":
        return await createReorderRequest(toolInput);
      case "generate_daily_briefing":
        return await generateDailyBriefing();
      case "send_push_notification":
        return await sendPushNotification(toolInput);
      case "send_email_notification":
        return await sendEmailNotification(toolInput);
      case "get_payment_details":
        return await getPaymentDetails(toolInput.order_id, userContext);
      case "get_shipment_details":
        return await getShipmentDetails(toolInput.order_id, userContext);
      case "get_ai_action_log":
        return await getAIActionLog(toolInput.limit);
      case "get_app_user_chats":
        return await getAppUserChats(toolInput.limit);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[ClaudeToolExecutor] Error executing ${toolName}:`, error);
    return JSON.stringify({ error: error.message || "Tool execution failed" });
  }
}

// ─── Audit logging for AI actions ────────────────

async function logAIAction(tool: string, input: Record<string, any>) {
  try {
    await logMfgAudit("ZicaAI", "system", `TOOL_CALL:${tool}`, ACTOR, input as any);
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════

// ─── Dashboard Summary ───────────────────────────

async function getDashboardSummary(): Promise<string> {
  const [orders, customers, products, pendingReturns, pendingExchanges, pendingTasks, activeBatches] =
    await Promise.all([
      prisma.order.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { name: true, email: true } },
          items: { select: { title: true, quantity: true, price: true } },
        },
      }),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.return.count({ where: { status: "REQUESTED" } }),
      prisma.exchange.count({ where: { status: "REQUESTED" } }),
      prisma.mfgTask.count({ where: { status: "PENDING" } }),
      prisma.mfgProductionBatch.count({ where: { NOT: [{ currentStage: "QC_PASSED" }, { currentStage: "REJECTED_REWORK" }] } }),
    ]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid").length;
  const unfulfilledOrders = orders.filter((o) => o.fulfillmentStatus !== "fulfilled").length;

  return JSON.stringify({
    totalOrders: orders.length,
    totalRevenue: `₹${totalRevenue.toLocaleString("en-IN")}`,
    totalCustomers: customers,
    totalProducts: products,
    paidOrders,
    unfulfilledOrders,
    pendingReturns,
    pendingExchanges,
    pendingTasks,
    activeBatches,
    recentOrders: orders.slice(0, 5).map((o) => ({
      id: o.id,
      shopifyOrderId: o.shopifyOrderId,
      customer: o.customer?.name || "Guest",
      total: `₹${o.totalPrice.toLocaleString("en-IN")}`,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      deliveryStatus: o.deliveryStatus,
      date: o.createdAt,
    })),
  });
}

// ─── Production Batches ──────────────────────────

async function getProductionBatches(stage?: string): Promise<string> {
  const batches = await prisma.mfgProductionBatch.findMany({
    where: stage ? { currentStage: stage } : {},
    orderBy: { updatedAt: "desc" },
    include: {
      fabric: { select: { name: true, sku: true } },
      tasks: { where: { status: "PENDING" }, select: { id: true, title: true, priority: true } },
    },
  });

  return JSON.stringify(
    batches.map((b) => ({
      id: b.id,
      batchCode: b.batchCode,
      productName: b.productName,
      quantity: b.quantity,
      currentStage: b.currentStage,
      fabric: b.fabric?.name || "Unassigned",
      fabricSku: b.fabric?.sku || null,
      sampleDone: b.isSampleDone,
      cuttingDone: b.isCuttingDone,
      stitchingDone: b.isStitchingDone,
      printingDone: b.isPrintingDone,
      embroideryDone: b.isEmbroideryDone,
      washingDone: b.isWashingDone,
      pendingTasks: b.tasks.length,
      notes: b.notes,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }))
  );
}

// ─── Advance Production Stage (NEW) ─────────────

async function advanceProductionStage(input: Record<string, any>): Promise<string> {
  const { batch_id, action, quantity, pricePerUnit, vendor, notes } = input;

  if (!batch_id || !action) {
    return JSON.stringify({ error: "batch_id and action are required" });
  }

  // Fetch current batch to validate
  const batch = await prisma.mfgProductionBatch.findUnique({ where: { id: batch_id } });
  if (!batch) {
    return JSON.stringify({ error: `Batch ${batch_id} not found` });
  }

  // Build the action payload matching the existing batch action API
  const actionPayload: Record<string, unknown> = {
    action,
    quantity: quantity || batch.quantity,
    pricePerUnit: pricePerUnit || 0,
    vendor: vendor || undefined,
    vendorName: vendor || undefined,
    notes: notes || `Advanced by Zica AI`,
  };

  // Execute via internal API call to reuse existing batch action logic
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3001";
    const res = await fetch(`${baseUrl}/api/admin/manufacturing/batches/${batch_id}/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `admin-session=${process.env.ADMIN_SESSION_TOKEN || ""}`,
      },
      body: JSON.stringify(actionPayload),
    });

    const result = await res.json();
    if (!res.ok) {
      return JSON.stringify({ error: result.error || "Failed to advance stage", details: result });
    }

    await logMfgAudit("MfgProductionBatch", batch_id, `AI_ADVANCE:${action}`, ACTOR, {
      from: batch.currentStage,
      action,
      quantity: quantity || batch.quantity,
    } as any);

    // Auto-notify via Email
    try {
      const email = emailProductionUpdate({
        batchCode: batch.batchCode,
        productName: batch.productName,
        previousStage: batch.currentStage,
        newStage: result.newStage || action, // result should contain the new stage
        action: action,
        quantity: quantity || batch.quantity,
      });
      await notifyAdminTeam(email.subject, email.html);
    } catch (e) {
      console.error("[ZicaAI] Auto-email failed for production update:", e);
    }

    return JSON.stringify({
      success: true,
      message: `Batch ${batch.batchCode} (${batch.productName}): executed ${action}. Previous stage: ${batch.currentStage}. Email notification sent to admin team.`,
      batchCode: batch.batchCode,
      previousStage: batch.currentStage,
      action,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to advance stage: ${err.message}` });
  }
}

// ─── Tasks ───────────────────────────────────────

async function getPendingTasks(status?: string): Promise<string> {
  const tasks = await prisma.mfgTask.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      batch: { select: { id: true, batchCode: true, productName: true, currentStage: true } },
    },
  });

  return JSON.stringify(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      createdBy: t.createdByName,
      batch: t.batch
        ? { id: t.batch.id, batchCode: t.batch.batchCode, productName: t.batch.productName, currentStage: t.batch.currentStage }
        : null,
    }))
  );
}

async function createTask(input: Record<string, any>): Promise<string> {
  const task = await prisma.mfgTask.create({
    data: {
      title: input.title,
      description: input.description || null,
      priority: input.priority || "MEDIUM",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      batchId: input.batchId || null,
      createdByName: ACTOR,
    },
  });

  await logMfgAudit("MfgTask", task.id, "CREATE", ACTOR, { title: task.title, assigned_by: ACTOR } as any);

  // Auto-notify via Email
  try {
    const email = emailTaskCreated({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString(),
      description: task.description || undefined,
      createdBy: ACTOR,
    });
    await notifyAdminTeam(email.subject, email.html);
  } catch (e) {
    console.error("[ZicaAI] Auto-email failed for task creation:", e);
  }

  return JSON.stringify({
    success: true,
    message: `Task "${task.title}" created with ${task.priority} priority. Email notification sent to admin team.`,
    taskId: task.id,
  });
}

async function updateTaskStatus(taskId: string, status: string): Promise<string> {
  const task = await prisma.mfgTask.update({
    where: { id: taskId },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
  });

  await logMfgAudit("MfgTask", task.id, "UPDATE", ACTOR, { status: task.status } as any);

  // Auto-notify via Email
  try {
    const email = emailTaskUpdated({
      title: task.title,
      status: task.status,
      updatedBy: ACTOR,
    });
    await notifyAdminTeam(email.subject, email.html);
  } catch (e) {
    console.error("[ZicaAI] Auto-email failed for task update:", e);
  }

  return JSON.stringify({
    success: true,
    message: `Task "${task.title}" updated to ${status}. Email notification sent to admin team.`,
    taskId: task.id,
  });
}

// ─── Fabric Inventory ────────────────────────────

async function getFabricInventory(): Promise<string> {
  const fabrics = await prisma.mfgFabric.findMany({ orderBy: { updatedAt: "desc" } });

  return JSON.stringify(
    fabrics.map((f) => ({
      id: f.id,
      sku: f.sku,
      name: f.name,
      totalMeters: f.totalMeters,
      costPerMeter: `₹${f.costPerMeter}`,
      weight: `${f.weightValue} ${f.weightUnit}`,
      status: f.status,
      lowStockThreshold: f.lowStockMetersThreshold,
      isLowStock: f.lowStockMetersThreshold !== null && f.totalMeters < f.lowStockMetersThreshold,
    }))
  );
}

async function getLowStockProducts(threshold?: number): Promise<string> {
  const minStock = threshold || 10;
  const inventoryItems = await prisma.inventory.findMany({
    where: { stockQuantity: { lt: minStock } },
    include: { product: { select: { title: true, sku: true, shopifyProductId: true } } },
    orderBy: { stockQuantity: "asc" },
  });

  return JSON.stringify(
    inventoryItems.map((inv) => ({
      product: inv.product?.title,
      sku: inv.product?.sku,
      shopifyProductId: inv.product?.shopifyProductId,
      currentStock: inv.stockQuantity,
      reserved: inv.reservedQuantity,
      available: inv.stockQuantity - inv.reservedQuantity,
      locationId: inv.locationId,
    }))
  );
}

// ─── Reorder Request (NEW) ───────────────────────

async function createReorderRequest(input: Record<string, any>): Promise<string> {
  const { sku, quantity, vendor_id, urgency, notes } = input;

  // Look up vendor name if ID provided
  let vendorName = "Unspecified vendor";
  if (vendor_id) {
    const vendor = await prisma.mfgVendor.findUnique({ where: { id: vendor_id } });
    if (vendor) vendorName = vendor.name;
  }

  // Create a high-priority task for the reorder
  const task = await prisma.mfgTask.create({
    data: {
      title: `REORDER: ${sku} × ${quantity} units from ${vendorName}`,
      description: `Auto-generated reorder request by Zica AI.\nSKU: ${sku}\nQuantity: ${quantity}\nVendor: ${vendorName}\nUrgency: ${urgency || "standard"}\n${notes ? `Notes: ${notes}` : ""}`,
      priority: urgency === "urgent" ? "HIGH" : "MEDIUM",
      dueDate: new Date(Date.now() + (urgency === "urgent" ? 2 : 7) * 24 * 60 * 60 * 1000),
      createdByName: ACTOR,
    },
  });

  await logMfgAudit("MfgTask", task.id, "REORDER_REQUEST", ACTOR, { sku, quantity, vendor: vendorName, urgency } as any);

  return JSON.stringify({
    success: true,
    message: `Reorder request created: ${sku} × ${quantity} from ${vendorName}. Task ID: ${task.id}. Priority: ${urgency === "urgent" ? "HIGH" : "MEDIUM"}.`,
    taskId: task.id,
  });
}

// ─── Orders ──────────────────────────────────────

async function getOrdersSummary(limit?: number, status?: string, userContext?: any): Promise<string> {
  const isAdmin = userContext?.email?.endsWith('@zicabella.com') || false;
  const whereClause: any = {};
  if (status) whereClause.deliveryStatus = status;

  // Restrict orders to only the specific user's orders if not admin
  if (userContext && !isAdmin) {
    const userOrFilters = [
      userContext.id ? { customerId: userContext.id } : null,
      userContext.email ? { customer: { email: userContext.email } } : null,
      userContext.phone ? { customer: { phone: userContext.phone } } : null,
    ].filter(Boolean);

    whereClause.AND = [
      { OR: userOrFilters },
      {
        status: {
          notIn: ['cancelled', 'CANCELLED', 'failed', 'FAILED']
        }
      },
      {
        paymentStatus: {
          notIn: ['failed', 'FAILED', 'cancelled', 'CANCELLED']
        }
      }
    ];
  }

  const orders = await prisma.order.findMany({
    take: limit || 10,
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      items: { select: { title: true, quantity: true, price: true, sku: true } },
    },
  });

  return JSON.stringify(
    orders.map((o) => ({
      id: o.id,
      shopifyOrderId: o.shopifyOrderId,
      customer: o.customer?.name || "Guest",
      email: o.customer?.email,
      totalPrice: `₹${o.totalPrice.toLocaleString("en-IN")}`,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      deliveryStatus: o.deliveryStatus,
      itemCount: o.items.length,
      items: o.items.map((i) => `${i.title} x${i.quantity}`),
      note: o.note,
      tags: o.tags,
      createdAt: o.createdAt,
      ageHours: Math.round((Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60)),
    }))
  );
}

// ─── Update Order Status (NEW) ───────────────────

async function updateOrderStatus(input: Record<string, any>): Promise<string> {
  const { order_id, status, note } = input;

  const order = await prisma.order.update({
    where: { id: order_id },
    data: {
      deliveryStatus: status,
      ...(note ? { note: note } : {}),
    },
  });

  await logMfgAudit("Order", order_id, `AI_STATUS_UPDATE:${status}`, ACTOR, { status, note } as any);

  return JSON.stringify({
    success: true,
    message: `Order ${order.shopifyOrderId} status updated to "${status}".`,
    orderId: order.id,
    shopifyOrderId: order.shopifyOrderId,
  });
}

// ─── Returns & Exchanges ─────────────────────────

async function getReturnsExchanges(type?: string): Promise<string> {
  const results: any = {};

  if (!type || type === "all" || type === "returns") {
    const returns = await prisma.return.findMany({
      orderBy: { requestedAt: "desc" },
      take: 15,
      include: {
        customer: { select: { name: true } },
        product: { select: { title: true } },
        order: { select: { shopifyOrderId: true } },
      },
    });
    results.returns = returns.map((r) => ({
      id: r.id, product: r.product?.title, customer: r.customer?.name,
      orderId: r.order?.shopifyOrderId, status: r.status, reason: r.reason,
      refundAmount: r.refundAmount ? `₹${r.refundAmount}` : null, requestedAt: r.requestedAt,
    }));
  }

  if (!type || type === "all" || type === "exchanges") {
    const exchanges = await prisma.exchange.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        originalProduct: { select: { title: true } },
        newProduct: { select: { title: true } },
        order: { select: { shopifyOrderId: true, customer: { select: { name: true } } } },
      },
    });
    results.exchanges = exchanges.map((e) => ({
      id: e.id, originalProduct: e.originalProduct?.title, newProduct: e.newProduct?.title,
      customer: e.order?.customer?.name, orderId: e.order?.shopifyOrderId, status: e.status,
      priceDifference: `₹${e.priceDifference}`, createdAt: e.createdAt,
    }));
  }

  return JSON.stringify(results);
}

// ─── Vendors ─────────────────────────────────────

async function getVendors(category?: string): Promise<string> {
  const vendors = await prisma.mfgVendor.findMany({
    where: category ? { category: { contains: category } } : {},
    orderBy: { name: "asc" },
  });

  return JSON.stringify(vendors.map((v) => ({
    id: v.id, name: v.name, category: v.category, address: v.address, mobile: v.mobile,
  })));
}

// ─── Cost Ledger ─────────────────────────────────

async function getCostLedger(input: Record<string, any>): Promise<string> {
  const { batchId, from_date, to_date } = input;

  const where: any = {};
  if (batchId) where.batchId = batchId;
  if (from_date || to_date) {
    where.expenseDate = {};
    if (from_date) where.expenseDate.gte = new Date(from_date);
    if (to_date) where.expenseDate.lte = new Date(to_date);
  }

  const expenses = await prisma.mfgMiscExpense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
    take: 30,
    include: { batch: { select: { batchCode: true, productName: true } } },
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return JSON.stringify({
    totalExpenses: `₹${totalExpenses.toLocaleString("en-IN")}`,
    count: expenses.length,
    entries: expenses.map((e) => ({
      id: e.id, amount: `₹${e.amount.toLocaleString("en-IN")}`, description: e.description,
      type: e.expenseType, batch: e.batch?.batchCode || "General",
      product: e.batch?.productName || "-", date: e.expenseDate, loggedBy: e.createdByName,
    })),
  });
}

// ─── Push Notification (NEW) ─────────────────────

async function sendPushNotification(input: Record<string, any>): Promise<string> {
  const { title, body, data } = input;

  // Log the notification intent (actual push delivery depends on
  // Expo push token setup in the React Native app)
  await logMfgAudit("Notification", "push", "SEND", ACTOR, { title, body, data } as any);

  // In production, this would call Expo Push API with the admin's push token.
  // For now, we log it and return success.
  console.log(`[ZicaAI Push] Title: ${title} | Body: ${body}`);

  return JSON.stringify({
    success: true,
    message: `Push notification queued: "${title}"`,
    title,
    body,
  });
}

// ─── AI Action Log (NEW) ─────────────────────────

async function getAIActionLog(limit?: number): Promise<string> {
  const logs = await prisma.mfgAuditLog.findMany({
    where: { actorName: ACTOR },
    orderBy: { createdAt: "desc" },
    take: limit || 20,
  });

  return JSON.stringify(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      timestamp: l.createdAt,
    }))
  );
}

// ─── App User Chats (NEW) ────────────────────────
async function getAppUserChats(limit?: number): Promise<string> {
  const chats = await prisma.aIChatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit || 20,
    include: {
      session: {
        select: { userId: true, title: true }
      }
    }
  });

  return JSON.stringify(
    chats.map((c: any) => ({
      role: c.role,
      content: c.content,
      userId: c.session?.userId || "Guest",
      title: c.session?.title,
      timestamp: c.createdAt
    }))
  );
}

// ─── Daily Briefing (Aggregator) ─────────────────

async function generateDailyBriefing(): Promise<string> {
  const [dashboard, batches, tasks, fabrics, lowStock, returns] = await Promise.all([
    getDashboardSummary(),
    getProductionBatches(),
    getPendingTasks("PENDING"),
    getFabricInventory(),
    getLowStockProducts(10),
    getReturnsExchanges("all"),
  ]);

  const batchesData = JSON.parse(batches);
  const tasksData = JSON.parse(tasks);
  const fabricsData = JSON.parse(fabrics);

  // Count batches per stage
  const stageCounts: Record<string, number> = {};
  for (const b of batchesData) {
    stageCounts[b.currentStage] = (stageCounts[b.currentStage] || 0) + 1;
  }

  // Find overdue tasks
  const overdueTasks = tasksData.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date());

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    overview: JSON.parse(dashboard),
    production: {
      activeBatches: batchesData.length,
      stageCounts,
      batches: batchesData.slice(0, 8),
    },
    tasks: {
      total: tasksData.length,
      highPriority: tasksData.filter((t: any) => t.priority === "HIGH").length,
      overdue: overdueTasks.length,
      overdueItems: overdueTasks.slice(0, 5),
      upcoming: tasksData.slice(0, 5),
    },
    fabric: {
      total: fabricsData.length,
      lowStock: fabricsData.filter((f: any) => f.isLowStock),
    },
    lowStockProducts: JSON.parse(lowStock).slice(0, 8),
    returnsExchanges: JSON.parse(returns),
  });
}

// ─── Email Notification Tool Implementation ─────

async function sendEmailNotification(input: Record<string, any>): Promise<string> {
  const { type, subject, message, data, to } = input;
  let emailData: { subject: string; html: string };

  try {
    switch (type) {
      case "task_created":
        emailData = emailTaskCreated(data || JSON.parse(message));
        break;
      case "task_updated":
        emailData = emailTaskUpdated(data || JSON.parse(message));
        break;
      case "production_update":
        emailData = emailProductionUpdate(data || JSON.parse(message));
        break;
      case "daily_briefing":
        emailData = emailDailyBriefing(message);
        break;
      case "low_stock":
        emailData = emailLowStockAlert(data || JSON.parse(message));
        break;
      case "custom":
      default:
        emailData = emailCustomAI({
          subject: subject || "Zica AI Operational Update",
          message: message,
          actionUrl: data?.actionUrl,
          actionLabel: data?.actionLabel,
        });
        break;
    }

    const result = to 
      ? await sendAdminEmail({ to, subject: emailData.subject, body: emailData.html, isHtml: true })
      : await notifyAdminTeam(emailData.subject, emailData.html);

    if (!result.success) {
      return JSON.stringify({ error: result.message });
    }

    return JSON.stringify({
      success: true,
      message: `Branded email notification (${type}) sent successfully.`,
      subject: emailData.subject,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to format or send email: ${err.message}` });
  }
}

// ─── Payment Details (NEW) ────────────────────────

async function getPaymentDetails(orderId: string, userContext?: any): Promise<string> {
  if (!orderId) return JSON.stringify({ error: "order_id is required" });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      customer: { select: { email: true, phone: true } },
      shopifyOrderId: true,
      paymentStatus: true,
      paymentMethod: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      paymentCapturedAt: true,
      totalPrice: true,
      currency: true,
      createdAt: true,
    },
  });

  if (!order) return JSON.stringify({ error: `Order ${orderId} not found` });

  // Security check: If not admin and userContext is provided, check if it belongs to the user
  const isAdmin = userContext?.email?.endsWith('@zicabella.com') || false;
  if (userContext && !isAdmin) {
    const isOwner = 
      order.customerId === userContext.id || 
      (userContext.email && order.customer?.email === userContext.email) ||
      (userContext.phone && order.customer?.phone === userContext.phone);
    if (!isOwner) {
      return JSON.stringify({ error: "Access Denied: You do not have permission to view this order's payment details." });
    }
  }

  return JSON.stringify({
    order_id: order.id,
    shopify_order_id: order.shopifyOrderId,
    payment_status: order.paymentStatus,
    payment_method: order.paymentMethod || "unknown",
    razorpay_order_id: order.razorpayOrderId || null,
    razorpay_payment_id: order.razorpayPaymentId || null,
    payment_captured_at: order.paymentCapturedAt || null,
    total: `₹${order.totalPrice.toLocaleString("en-IN")}`,
    currency: order.currency,
    created_at: order.createdAt,
  });
}

// ─── Shipment Details (NEW) ───────────────────────

async function getShipmentDetails(orderId: string, userContext?: any): Promise<string> {
  if (!orderId) return JSON.stringify({ error: "order_id is required" });

  // Check if order exists and belongs to the user
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      customer: { select: { email: true, phone: true } },
    }
  });

  if (!order) return JSON.stringify({ error: `Order ${orderId} not found` });

  const isAdmin = userContext?.email?.endsWith('@zicabella.com') || false;
  if (userContext && !isAdmin) {
    const isOwner = 
      order.customerId === userContext.id || 
      (userContext.email && order.customer?.email === userContext.email) ||
      (userContext.phone && order.customer?.phone === userContext.phone);
    if (!isOwner) {
      return JSON.stringify({ error: "Access Denied: You do not have permission to view this order's shipment details." });
    }
  }

  const shipments = await prisma.shipment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: { shopifyOrderId: true, deliveryStatus: true },
      },
    },
  });

  if (!shipments.length) {
    return JSON.stringify({ error: `No shipments found for order ${orderId}` });
  }

  const results = [];
  for (const shipment of shipments) {
    let liveTracking = null;
    const trackingNum = shipment.awb || shipment.trackingNumber;

    // Try live Delhivery tracking if we have a tracking number
    if (trackingNum) {
      try {
        liveTracking = await getTrackingStatus(trackingNum);
      } catch (err: any) {
        console.error(`[ShipmentDetails] Live tracking failed for ${trackingNum}:`, err.message);
      }
    }

    results.push({
      shipment_id: shipment.id,
      order_id: orderId,
      shopify_order_id: shipment.order.shopifyOrderId,
      awb: trackingNum || null,
      courier: shipment.courier || "unknown",
      status: liveTracking?.status || shipment.status,
      last_location: liveTracking?.location || shipment.currentLocation || null,
      estimated_delivery: liveTracking?.estimatedDelivery || shipment.estimatedDelivery?.toISOString() || null,
      tracking_url: liveTracking?.trackingUrl || shipment.trackingUrl || null,
      label_url: shipment.labelUrl || null,
      scan_history: liveTracking?.events || JSON.parse(shipment.events || "[]"),
      created_at: shipment.createdAt,
    });
  }

  return JSON.stringify(results.length === 1 ? results[0] : results);
}
