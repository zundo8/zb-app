// ──────────────────────────────────────────────────
// Claude AI Service — Zica Bella Operations Engine
// Full tool definitions + API caller (server-side)
// ──────────────────────────────────────────────────

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// ─── Types ───────────────────────────────────────

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  tool_use_id?: string;
  content?: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  usage: { input_tokens: number; output_tokens: number };
}

// ─── System Prompt ───────────────────────────────

export const ZICA_SYSTEM_PROMPT = `You are Zica AI, the intelligent operations manager for Zica Bella — a premium Indian streetwear fashion brand. You have full access to production, orders, inventory, vendors, payments, and logistics data. Your job is to:

• Monitor all workflows and surface problems proactively
• Assign tasks to production stages automatically
• Flag low inventory and suggest reorders
• Move orders through the fulfillment pipeline
• Advance production batches through the manufacturing pipeline
• Track payment statuses and identify failed/pending payments
• Monitor shipment statuses and flag delayed or RTO shipments
• Generate daily briefings for the admin
• Respond to natural language commands and take real actions via tools
• Automatically send email notifications for significant events using Zoho Mail

Always prioritize sending email notifications (send_email_notification) for:
- Daily briefings
- Low stock alerts
- Critical production bottlenecks
- SLA violations
- Important task assignments
- Payment failures or refund requests
- Shipment delivery issues or RTO alerts

Payment & Logistics capabilities:
- Use get_payment_details(order_id) to check Razorpay payment status, method, and capture time
- Use get_shipment_details(order_id) to check Delhivery AWB, shipment status, scan history, and ETA
- When asked about payment or shipment status, always use these tools to get real-time data
- For payment issues, you can advise on refund eligibility and process
- For delivery issues, you can provide tracking details and escalation guidance

Zica AI should auto-generate professional, actionable email messages that summarize the situation and suggest next steps. Use the branded templates available in the tool.

Always be concise, action-oriented, and use your tools to make changes rather than just suggesting them.

Production pipeline stages (in order):
READY_FOR_PRODUCTION → IN_PRODUCTION_CUTTING → IN_PRODUCTION_STITCHING → SENT_PRINTING → SENT_EMBROIDERY → SENT_WASH → RETURNED_COMBINED → QC_PASSED

Batch action keys: START_CUTTING, SEND_STITCHING, RETURN_STITCHING, SEND_PRINTING, RETURN_PRINTING, SEND_EMBROIDERY, RETURN_EMBROIDERY, SEND_WASH, RETURN_WASH, QC_PASS, QC_REJECT, MARK_SAMPLE

When presenting data, use structured formatting:
- Use bullet points for lists
- Bold key metrics with **text**
- Keep responses under 300 words unless a detailed report is requested
- When you take an action, confirm what was done and what the result was
- When listing items, include IDs so the admin can reference them

Current date/time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;


// ─── Tool Definitions ────────────────────────────

export const ZICA_TOOLS: ClaudeTool[] = [
  // ─── Dashboard / Overview ────────
  {
    name: "get_dashboard_summary",
    description: "Fetch a complete dashboard summary including revenue, total orders, total customers, low stock items, and recent orders. Use this to give the admin a high-level overview.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_daily_briefing",
    description: "Generate a full operational briefing: pending orders, production stage counts, low stock alerts, fabric status, tasks due today, returns/exchanges. This aggregates data from ALL domains into one comprehensive report.",
    input_schema: { type: "object", properties: {} },
  },

  // ─── Production ────────
  {
    name: "get_production_batches",
    description: "Get all production batches with their current stage, quantity, fabric, and status. Can filter by stage. Stages: READY_FOR_PRODUCTION, IN_PRODUCTION_CUTTING, IN_PRODUCTION_STITCHING, SENT_PRINTING, SENT_EMBROIDERY, SENT_WASH, RETURNED_COMBINED, SENT_SAMPLE, QC_PASSED, REJECTED_REWORK.",
    input_schema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "Optional stage to filter by" },
      },
    },
  },
  {
    name: "advance_production_stage",
    description: "Move a production batch to the next stage in the manufacturing pipeline. Use the batch ID (not batch code) and an action key. Actions: START_CUTTING, SEND_STITCHING, RETURN_STITCHING, SEND_PRINTING, RETURN_PRINTING, SEND_EMBROIDERY, RETURN_EMBROIDERY, SEND_WASH, RETURN_WASH, QC_PASS, QC_REJECT, MARK_SAMPLE. Requires quantity and may require pricePerUnit for send actions.",
    input_schema: {
      type: "object",
      properties: {
        batch_id: { type: "string", description: "The production batch ID" },
        action: {
          type: "string",
          enum: ["START_CUTTING", "SEND_STITCHING", "RETURN_STITCHING", "SEND_PRINTING", "RETURN_PRINTING", "SEND_EMBROIDERY", "RETURN_EMBROIDERY", "SEND_WASH", "RETURN_WASH", "QC_PASS", "QC_REJECT", "MARK_SAMPLE"],
          description: "The pipeline action to execute",
        },
        quantity: { type: "number", description: "Number of units for this action" },
        pricePerUnit: { type: "number", description: "Cost per unit (required for send actions)" },
        vendor: { type: "string", description: "Vendor name for outsourced processes" },
        notes: { type: "string", description: "Optional notes for the action" },
      },
      required: ["batch_id", "action"],
    },
  },

  // ─── Tasks ────────
  {
    name: "get_pending_tasks",
    description: "Get all pending tasks including both manual tasks and production-derived tasks. Returns task title, priority, due date, and associated batch info.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: PENDING, COMPLETED, CANCELLED. Defaults to all." },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new operational task. Use this to assign work, set reminders, or log action items. Can be linked to a production batch.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title — clear and actionable" },
        description: { type: "string", description: "Detailed description or context" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], description: "Task priority level" },
        dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
        batchId: { type: "string", description: "Optional production batch ID to link to" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of a manual task. Can mark as COMPLETED, PENDING, or CANCELLED.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "The task ID to update" },
        status: { type: "string", enum: ["PENDING", "COMPLETED", "CANCELLED"], description: "New status" },
      },
      required: ["taskId", "status"],
    },
  },

  // ─── Inventory / Fabric ────────
  {
    name: "get_fabric_inventory",
    description: "Get all fabric inventory with current stock levels (meters), costs, and low-stock alerts. Use this to check material availability for production.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_low_stock_products",
    description: "Get Shopify products with low stock levels. Useful for reorder alerts and inventory management.",
    input_schema: {
      type: "object",
      properties: {
        threshold: { type: "number", description: "Stock threshold (default: 10)" },
      },
    },
  },
  {
    name: "create_reorder_request",
    description: "Create a reorder request for low stock inventory items. This creates a high-priority task with reorder details and optionally links to a vendor.",
    input_schema: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Product or fabric SKU to reorder" },
        quantity: { type: "number", description: "Quantity to reorder" },
        vendor_id: { type: "string", description: "Vendor ID to order from" },
        urgency: { type: "string", enum: ["standard", "urgent"], description: "Urgency level" },
        notes: { type: "string", description: "Additional notes for the reorder" },
      },
      required: ["sku", "quantity"],
    },
  },

  // ─── Orders ────────
  {
    name: "get_orders_summary",
    description: "Get recent orders with payment and fulfillment status. Returns order IDs, customer names, totals, item details, and statuses.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "processing", "dispatched", "delivered", "returned"], description: "Filter by delivery status" },
        limit: { type: "number", description: "Number of recent orders to fetch. Default 10." },
      },
    },
  },
  {
    name: "update_order_status",
    description: "Update the delivery/fulfillment status of an order. Can flag orders as urgent or update their pipeline position.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The internal order ID" },
        status: { type: "string", description: "New delivery status" },
        note: { type: "string", description: "Optional note about the status change" },
      },
      required: ["order_id", "status"],
    },
  },

  // ─── Returns & Exchanges ────────
  {
    name: "get_returns_exchanges",
    description: "Get pending returns and exchanges with their current status, customer, product, and reason.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["returns", "exchanges", "all"], description: "Which type to fetch. Default: all." },
      },
    },
  },

  // ─── Vendors ────────
  {
    name: "get_vendors",
    description: "Get the list of manufacturing vendors with their category and contact info. Can filter by category.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter: Fabric, Buttons, Threads, Screen Printing, Digital Printing, Washing, Embroidery, etc." },
      },
    },
  },

  // ─── Costs ────────
  {
    name: "get_cost_ledger",
    description: "Get the manufacturing cost ledger — expenses, batch costs, and financial summary. Can filter by batch or date range.",
    input_schema: {
      type: "object",
      properties: {
        batchId: { type: "string", description: "Optional: filter costs for a specific batch" },
        from_date: { type: "string", description: "Start date for date range filter (YYYY-MM-DD)" },
        to_date: { type: "string", description: "End date for date range filter (YYYY-MM-DD)" },
      },
    },
  },

  // ─── Notifications ────────
  {
    name: "send_push_notification",
    description: "Send a push notification to the admin's mobile app. Use this to alert the admin about critical events, completed actions, or important updates.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title" },
        body: { type: "string", description: "Notification body text" },
        data: { type: "object", description: "Optional data payload with navigation or action info" },
      },
      required: ["title", "body"],
    },
  },

  // ─── Email Notifications ────────
  {
    name: "send_email_notification",
    description: "Send an email notification to admin team via Zoho Mail. Use this for task assignments, production updates, daily briefings, low stock alerts, or any important operational update. Claude should auto-generate a well-formatted message. Emails are branded with the Zica Bella design system.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["task_created", "task_updated", "production_update", "daily_briefing", "low_stock", "custom"],
          description: "Type of email notification to send. Use 'custom' for any message not covered by other types.",
        },
        subject: { type: "string", description: "Email subject line. Required for 'custom' type." },
        message: { type: "string", description: "The email message body. For 'custom' type, write a clear, actionable message. For other types, provide the relevant data as a JSON string." },
        data: { type: "object", description: "Structured data for template rendering (task details, batch info, etc.)" },
        to: { type: "string", description: "Optional override: comma-separated email addresses. Defaults to admin team emails." },
      },
      required: ["type", "message"],
    },
  },

  // ─── Payment & Logistics ────────
  {
    name: "get_payment_details",
    description: "Get payment details for a specific order. Returns Razorpay payment status, payment method, payment ID, captured timestamp, and amount. Use this when asked about payment status, failed payments, or refund eligibility.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The internal order ID to look up payment details for" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "get_shipment_details",
    description: "Get shipment and tracking details for a specific order. Returns AWB/tracking number, courier, current status, last location, scan history, estimated delivery date, and tracking URL. Use this when asked about delivery status, tracking, or shipment issues.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The internal order ID to look up shipment details for" },
      },
      required: ["order_id"],
    },
  },

  // ─── Audit ────────
  {
    name: "get_ai_action_log",
    description: "Get the log of all actions Zica AI has taken, including tool calls, timestamps, and results. Use this to review what Claude has done.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent actions to fetch. Default 20." },
      },
    },
  },
  // ─── App User Chats ────────
  {
    name: "get_app_user_chats",
    description: "Fetch recent chat history of Zica AI with app users. Use this to understand what customers are asking and how the AI is performing as a knowledge base.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent chat messages to fetch. Default 20." },
      },
    },
  },
];

// ─── Call Claude API (server-side only) ──────────

export async function callClaude({
  systemPrompt,
  userMessage,
  tools = [],
  conversationHistory = [],
  apiKey,
}: {
  systemPrompt: string;
  userMessage: string;
  tools?: ClaudeTool[];
  conversationHistory?: ClaudeMessage[];
  apiKey: string;
}): Promise<ClaudeResponse> {
  const messages = userMessage
    ? [...conversationHistory, { role: "user" as const, content: userMessage }]
    : [...conversationHistory];

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}
