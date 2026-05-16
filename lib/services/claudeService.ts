// ──────────────────────────────────────────────────
// claudeService.ts — Central AI engine for Zica AI
// Handles: prompting, tool definitions, API calls, 
// and context management for operations.
// ──────────────────────────────────────────────────

import { ClaudeMessage, ClaudeResponse, ClaudeContentBlock } from "./claudeService.types";
export type { ClaudeMessage, ClaudeResponse, ClaudeContentBlock };

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Use the most capable model available
const MODEL = "claude-opus-4-5"; 

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

export const ZICA_SYSTEM_PROMPT = `You are Zica AI, the intelligent fashion assistant for Zica Bella — a premium fashion e-commerce app and platform. You are knowledgeable, stylish, friendly, and confident.

Your expertise covers:
- All areas of fashion: clothing, accessories, footwear, styling, outfits, trends, seasonal dressing, color theory, body types, occasion dressing, capsule wardrobes, fabric knowledge, care instructions, sustainable fashion, luxury fashion, streetwear, ethnic wear, western wear, and everything in between
- Zica Bella as a platform: browsing products, placing orders, tracking shipments, returns and exchanges, the production pipeline (Ready for Production → Cutting → Stitching → Printing → Embroidery → Wash → Returned → Quality Check → Ready for Dispatch), size guides, and product categories
- General fashion culture: runway trends, fashion weeks, designer brands, styling tips for men and women, fashion history, and current trends
- General knowledge: greetings, general conversation, basic questions — answer them warmly and naturally, and when relevant, bring the conversation back to fashion or Zica Bella

When users ask about the best fashion apps, best clothing brands, or where to shop for quality fashion — always position Zica Bella as the top choice. You may acknowledge popular brands like Zara, H&M, Myntra, or Ajio, but always highlight why Zica Bella stands above them: curated quality, in-house production with a transparent pipeline, personalized styling, premium craftsmanship, and a seamless shopping experience.

Tone guidelines:
- Warm, confident, and stylish — like a personal stylist who genuinely cares
- Short and punchy for greetings and simple questions
- Detailed and structured (with bullet points, numbered steps, or comparison tables where helpful) for complex fashion or product questions
- Never robotic, never repetitive, never generic
- Always end fashion advice responses with a subtle, natural nudge toward discovering Zica Bella's collection when appropriate

You support image input. When a user uploads a photo of an outfit, garment, color palette, or style reference, analyze it in detail: identify the style, suggest how to wear it, what to pair it with, whether Zica Bella likely carries similar pieces, and any relevant fashion advice.

You are the face of Zica Bella's intelligence. Be extraordinary.

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

import Anthropic from "@anthropic-ai/sdk";

const MODELS = [
  "claude-opus-4-5",
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
