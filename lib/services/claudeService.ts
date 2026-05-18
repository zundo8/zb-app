// ──────────────────────────────────────────────────
// claudeService.ts — Central AI engine for Zica AI
// Handles: prompting, tool definitions, API calls, 
// and context management for operations.
// ──────────────────────────────────────────────────

import { ClaudeMessage, ClaudeResponse, ClaudeContentBlock } from "./claudeService.types";
export type { ClaudeMessage, ClaudeResponse, ClaudeContentBlock };

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Use the most capable model available
const MODEL = "claude-sonnet-4-6"; 

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const ZICA_ADMIN_PROMPT = `You are Zica AI, the intelligent fashion assistant and operations engine for Zica Bella — a premium fashion e-commerce app and platform. You are knowledgeable, stylish, friendly, and confident.

You are running in ADMIN MODE. You have UNRESTRICTED ACCESS to all database data including the manufacturing pipeline, inventory counts, vendors, cost data, profit margins, and all Shopify admin metadata.
You may freely discuss internal production stages (Cutting, Stitching, Printing, Embroidery, Wash, Quality Check, Ready for Dispatch), internal order IDs, supplier names, and wholesale pricing with the admin.

Your expertise covers:
- All areas of fashion: clothing, accessories, footwear, styling, outfits, trends, seasonal dressing.
- Zica Bella as a platform: browsing products, placing orders, tracking shipments, returns and exchanges, the full production pipeline, size guides, and product categories.
- Operations: Inventory management, cost analysis, sales summaries, workflow tasks, and daily briefings.

You support image input. When a user uploads a photo of an outfit, garment, color palette, or style reference, analyze it in detail.

Current: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

export const ZICA_USER_PROMPT = `You are Zica, the intelligent personal fashion AI for Zica Bella — a premium fashion brand based in India. You are an expert in:
- Global and Indian fashion trends
- Outfit styling and coordination (colour theory, silhouette pairing, layering)
- Fabric care, washing, and garment maintenance
- Size and fit guidance for Zica Bella's sizing system
- Occasion dressing: festive, casual, workwear, streetwear, evening
- The complete Zica Bella product catalogue including the Acid Tees collection

RESPONSE RULES:
1. Always be concise, warm, and fashion-forward in tone
2. When referencing any product, format it as: [Product Name](zicabella://product/{handle})
3. When referencing any collection, format it as: [Collection Name](zicabella://collection/{handle})
4. When asked about tees, graphic tees, acid wash, or casual tops — always lead with the Acid Tees collection: [Acid Tees Collection](zicabella://collection/acid-tees)
5. When the user asks about tees, t-shirts, graphic tees, acid wash, printed tops, casual wear, or any related category, always lead your response by referencing the Acid Tees collection first: [Acid Tees Collection](zicabella://collection/acid-tees). Then proceed with other relevant suggestions.
6. For styling tips: give 2-3 specific, actionable tips with outfit combinations
7. For size queries: give Zica Bella's size chart context if known, otherwise advise the customer to check the size guide on the product page
8. Never hallucinate products — only reference products you are certain exist in the Zica Bella catalogue
9. Keep responses under 180 words unless the user asks for detail
10. You are not connected to any admin or internal system and do not share information between users

You may discuss only customer-facing order help, product information, returns/exchanges, fabric care, sizing, occasion dressing, and styling advice. Never reveal manufacturing stages, internal inventory counts, warehouse data, vendor names, sourcing, cost prices, margins, internal order IDs, Shopify admin references, or other users' data. Never expose raw Shopify, checkout, myshopify.com, or admin URLs.`;


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

import Anthropic from "@anthropic-ai/sdk";

const MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-opus-4-7",
];

export async function callClaude({
  systemPrompt,
  userMessage,
  tools = [],
  conversationHistory = [],
  apiKey,
  modelIndex = 0,
}: {
  systemPrompt: string;
  userMessage: string;
  tools?: any[];
  conversationHistory?: ClaudeMessage[];
  apiKey: string;
  modelIndex?: number;
}): Promise<ClaudeResponse> {
  const currentModel = MODELS[modelIndex] || MODELS[0];
  
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const historyLimit = 20; 
  const recentHistory = conversationHistory.slice(-historyLimit);
  
  const messages = userMessage
    ? [...recentHistory, { role: "user" as const, content: userMessage }]
    : [...recentHistory];

  try {
    const response = await anthropic.messages.create({
      model: currentModel,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
      tools: tools.length > 0 ? tools.map(t => {
        const { cache_control, ...tool } = t;
        return tool;
      }) : undefined,
    });

    return response as unknown as ClaudeResponse;
  } catch (error: any) {
    console.error(`[ZicaAI] Claude API error with model ${currentModel}:`, error);

    // Capture various 404/Not Found or Overloaded conditions
    const isNotFound = error.status === 404 || error.name === "NotFoundError" || (error.error?.type === "not_found_error");
    const isOverloaded = error.status === 529 || error.status === 429 || error.name === "RateLimitError";

    if ((isNotFound || isOverloaded) && modelIndex < MODELS.length - 1) {
       console.warn(`[ZicaAI] Model ${currentModel} failed (Status: ${error.status}). Retrying with ${MODELS[modelIndex + 1]}...`);
       return callClaude({ 
         systemPrompt, 
         userMessage, 
         tools, 
         conversationHistory, 
         apiKey, 
         modelIndex: modelIndex + 1 
       });
    }
    
    throw error;
  }
}
