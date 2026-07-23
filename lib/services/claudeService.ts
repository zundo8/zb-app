// ──────────────────────────────────────────────────
// claudeService.ts — Central AI engine for Zica AI
// Handles: tool definitions, prompting, and backward-compatible wrappers.
// ──────────────────────────────────────────────────

import { ClaudeMessage, ClaudeResponse, ClaudeContentBlock } from "./claudeService.types";
import { ZICA_ADMIN_PROMPT, ZICA_USER_PROMPT } from "@/lib/ai/prompts";
import { callClaude as executeCallClaude } from "@/lib/ai/claudeClient";
import Anthropic from "@anthropic-ai/sdk";

export type { ClaudeMessage, ClaudeResponse, ClaudeContentBlock };
export { ZICA_ADMIN_PROMPT, ZICA_USER_PROMPT };

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

// ─── Tool Definitions ────────────────────────────

export const ZICA_TOOLS: ClaudeTool[] = [
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

/**
 * Backward-compatible wrapper for callClaude.
 * Delegates to lib/ai/claudeClient.ts callClaude implementation.
 */
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
  apiKey?: string;
  modelIndex?: number;
}): Promise<ClaudeResponse> {
  const historyLimit = 20;
  const recentHistory = conversationHistory.slice(-historyLimit);
  const formattedMessages: Anthropic.MessageParam[] = recentHistory.map((m) => ({
    role: m.role,
    content: m.content as any,
  }));

  if (userMessage) {
    formattedMessages.push({ role: "user", content: userMessage });
  }

  const result = await executeCallClaude({
    systemPrompt,
    messages: formattedMessages,
    tools: tools.length > 0 ? tools.map(t => {
      const { cache_control, ...tool } = t;
      return tool;
    }) : undefined,
  });

  return result.response as unknown as ClaudeResponse;
}
