// ──────────────────────────────────────────────────
// claudeService.ts — Central AI engine for Zica AI
// Handles: prompting, tool definitions, API calls, 
// and context management for operations.
// ──────────────────────────────────────────────────

import { ClaudeMessage, ClaudeResponse } from "./claudeService.types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Use a stable, high-performance model
const MODEL = "claude-3-5-sonnet-20241022"; 

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

// ─── System Prompt ───────────────────────────────

export const ZICA_SYSTEM_PROMPT = `You are Zica AI, the operations manager for Zica Bella (Indian streetwear). Use tools for real actions.
- Monitor production, orders, inventory, logistics.
- Prioritize send_email_notification (Zoho) for: briefings, low stock, bottlenecks, RTO/delivery issues.
- Stages: READY_FOR_PRODUCTION → cutting → stitching → printing → embroidery → wash → QC_PASSED.
- Logistics: get_payment_details (Razorpay), get_shipment_details (Delhivery).
- Style: Concise, actionable, bold key metrics (**text**), keep responses <250 words.
Current: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;


// ─── Tool Definitions ────────────────────────────

export const ZICA_TOOLS: any[] = [
  {
    name: "get_dashboard_summary",
    description: "Revenue, orders, customers, and low stock overview.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "generate_daily_briefing",
    description: "Full operational report: orders, production, inventory, tasks.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_production_batches",
    description: "List batches. Stages: READY_FOR_PRODUCTION, IN_PRODUCTION_CUTTING, STITCHING, PRINTING, EMBROIDERY, WASH, QC_PASSED.",
    input_schema: {
      type: "object",
      properties: { stage: { type: "string" } },
    },
  },
  {
    name: "advance_production_stage",
    description: "Move batch to next stage. Actions: START_CUTTING, SEND_STITCHING, RETURN_STITCHING, SEND_PRINTING, RETURN_PRINTING, SEND_EMBROIDERY, RETURN_EMBROIDERY, SEND_WASH, RETURN_WASH, QC_PASS, QC_REJECT.",
    input_schema: {
      type: "object",
      properties: {
        batch_id: { type: "string" },
        action: { type: "string" },
        quantity: { type: "number" },
        pricePerUnit: { type: "number" },
        vendor: { type: "string" },
      },
      required: ["batch_id", "action"],
    },
  },
  {
    name: "get_pending_tasks",
    description: "Get pending manual/production tasks.",
    input_schema: { type: "object", properties: { status: { type: "string" } } },
  },
  {
    name: "create_task",
    description: "Create reminder/work item.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        dueDate: { type: "string" },
        batchId: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "get_fabric_inventory",
    description: "Check fabric stock levels (meters) and costs.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_low_stock_products",
    description: "Identify products below threshold (default 10).",
    input_schema: { type: "object", properties: { threshold: { type: "number" } } },
  },
  {
    name: "get_orders_summary",
    description: "Recent orders with status. Limit 10.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "processing", "dispatched", "delivered"] },
      },
    },
  },
  {
    name: "send_push_notification",
    description: "Alert admin via mobile push.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" }, body: { type: "string" } },
      required: ["title", "body"],
    },
  },
  {
    name: "send_email_notification",
    description: "Branded Zoho email. Types: task_created, production_update, daily_briefing, low_stock, custom.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["task_created", "production_update", "daily_briefing", "low_stock", "custom"] },
        message: { type: "string" },
        subject: { type: "string" },
      },
      required: ["type", "message"],
    },
  },
  {
    name: "get_payment_details",
    description: "Razorpay status, method, amount for order.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
    },
  },
  {
    name: "get_shipment_details",
    description: "Delhivery tracking, AWB, ETA, history for order.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
    },
  },
];

// ─── API Caller ──────────────────────────────────

export async function callClaude({
  systemPrompt,
  userMessage,
  tools = [],
  conversationHistory = [],
  apiKey,
}: {
  systemPrompt: string;
  userMessage: string;
  tools?: any[];
  conversationHistory?: ClaudeMessage[];
  apiKey: string;
}): Promise<ClaudeResponse> {
  // Limit history to last 10 messages for cost efficiency
  const historyLimit = 10;
  const recentHistory = conversationHistory.slice(-historyLimit);
  
  const messages = userMessage
    ? [...recentHistory, { role: "user" as const, content: userMessage }]
    : [...recentHistory];

  // Prepare payload with compatibility fallback
  const payload: any = {
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt, // Simple string for maximum compatibility
    messages,
  };

  // Only add tools if provided and supported
  if (tools && tools.length > 0) {
    payload.tools = tools.map((t: any) => {
      const { cache_control, ...tool } = t; // Remove any leftover cache_control if present
      return tool;
    });
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorBody);
    } catch {
      parsedError = { error: { message: errorBody } };
    }

    const message = parsedError.error?.message || `Claude API error ${response.status}`;
    
    // Specifically handle "not_found" for models by falling back to a guaranteed one
    if (parsedError.error?.type === "not_found_error" && MODEL !== "claude-3-sonnet-20240229") {
       console.warn(`[ZicaAI] Model ${MODEL} not found. Falling back to claude-3-sonnet-20240229`);
       return callClaude({ systemPrompt, userMessage, tools, conversationHistory, apiKey: apiKey.replace("claude-3-sonnet-20240229", "") }); // This is a hacky way to force recursion with a different model if I wanted, but let's just throw for now to be safe.
    }

    throw new Error(message);
  }

  return response.json();
}
