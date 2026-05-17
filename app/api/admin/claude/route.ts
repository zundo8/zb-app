// ──────────────────────────────────────────────────
// /api/admin/claude — Main chat endpoint
// Proxies to Claude API with server-side key,
// handles tool_use agentic loops, returns final
// response + tracked tool actions for inline display.
// ──────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  callClaude,
  ZICA_ADMIN_PROMPT,
  ZICA_TOOLS,
  type ClaudeMessage,
  type ClaudeContentBlock,
} from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import prisma from "@/lib/db";
import { getAISettings } from "@/lib/ai-settings-util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Resolve Claude API key: override → database → env */
async function resolveApiKey(overrideKey?: string): Promise<string> {
  if (overrideKey) return overrideKey;

  // Try database first
  try {
    const shop = await prisma.shop.findFirst({
      select: { claudeApiKey: true },
    });
    if (shop?.claudeApiKey) return shop.claudeApiKey;
  } catch (e) {
    console.warn("[ZicaAI] Could not read DB key:", e);
  }

  // Fallback to env vars
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, conversationHistory = [], sessionId, pageContext, contextData, overrideKey, imageBase64, imageMimeType } = body as {
      message: string;
      conversationHistory: ClaudeMessage[];
      sessionId?: string;
      pageContext?: string;
      contextData?: string;
      overrideKey?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    const activeApiKey = await resolveApiKey(overrideKey);

    if (!activeApiKey) {
      console.error("[ZicaAI Admin] Configuration Error: No API key found.");
      return NextResponse.json(
        { 
          error: "Claude API key not configured.", 
          details: "Set CLAUDE_API_KEY in environment or provide an override key in the dashboard settings.",
          type: "config_error" 
        },
        { status: 500 }
      );
    }

    if (!message?.trim() && !imageBase64) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // ─── Session Management ───
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const newSession = await prisma.aIChatSession.create({
        data: {
          title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        },
      });
      currentSessionId = newSession.id;
    }

    // Save user message
    await prisma.aIChatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: "user",
        content: message,
      },
    });

    // Build context-aware system prompt
    const aiSettings = getAISettings();
    let systemPrompt = ZICA_ADMIN_PROMPT;
    
    if (aiSettings.trainingRules && aiSettings.trainingRules.length > 0) {
      systemPrompt += `\n\nADDITIONAL DYNAMIC KNOWLEDGE & MEMORY:\nYou have been trained with the following additional custom operational instructions and knowledge. You MUST follow them strictly:\n`;
      aiSettings.trainingRules.forEach((rule: any) => {
        systemPrompt += `- ${rule.prompt}\n`;
      });
    }

    if (pageContext) {
      systemPrompt += `\n\nThe admin is currently viewing the "${pageContext}" page.`;
    }
    if (contextData) {
      systemPrompt += `\n\nCurrent page data context:\n${contextData}`;
    }

    // Inject live payment & logistics context
    try {
      const [pendingPayments, failedPayments, inTransitShipments, rtoShipments] = await Promise.all([
        prisma.order.count({ where: { paymentStatus: "pending" } }),
        prisma.order.count({ where: { paymentStatus: "failed" } }),
        prisma.shipment.count({ where: { status: { in: ["shipped", "in_transit", "out_for_delivery"] } } }),
        prisma.shipment.count({ where: { status: "rto" } }),
      ]);
      const pendingTotal = await prisma.order.aggregate({
        where: { paymentStatus: "pending" },
        _sum: { totalPrice: true },
      });
      systemPrompt += `\n\nLive Payment & Logistics Summary:
- Pending payments: ${pendingPayments} orders (₹${(pendingTotal._sum.totalPrice || 0).toLocaleString("en-IN")} total)
- Failed payments: ${failedPayments} orders
- In-transit shipments: ${inTransitShipments}
- RTO (Return to Origin): ${rtoShipments}`;
    } catch (err) {
      console.error("[ZicaAI] Failed to inject payment/logistics context:", err);
    }

    // ─── Agentic Loop ───
    let currentHistory: ClaudeMessage[] = [...conversationHistory];
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    const toolActions: { tool: string; input: any; result: any; timestamp: string }[] = [];

    // First iteration: send the user message (with optional image)
    const userText = message || "Analyze this image";
    let userContent: string | ClaudeContentBlock[];
    if (imageBase64) {
      userContent = [
        { type: "image", source: { type: "base64", media_type: imageMimeType || "image/jpeg", data: imageBase64 } },
        { type: "text", text: userText },
      ] as ClaudeContentBlock[];
    } else {
      userContent = userText;
    }
    currentHistory.push({ role: "user" as const, content: userContent });

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await callClaude({
        systemPrompt,
        userMessage: "", 
        tools: ZICA_TOOLS,
        conversationHistory: currentHistory,
        apiKey: activeApiKey,
      });

      if (response.stop_reason === "tool_use") {
        currentHistory.push({ role: "assistant" as const, content: response.content as ClaudeContentBlock[] });

        const toolResults: ClaudeContentBlock[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
            console.log(`[ZicaAI] Tool: ${block.name}`, JSON.stringify(block.input).slice(0, 200));

            const result = await executeClaudeTool(block.name, block.input || {});

            const parsedResult = JSON.parse(result);
            const isError = parsedResult.error !== undefined;

            toolActions.push({
              tool: block.name,
              input: block.input,
              result: parsedResult,
              timestamp: new Date().toISOString(),
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
              is_error: isError,
            });
          }
        }

        currentHistory.push({ role: "user" as const, content: toolResults });
        continue;
      }

      // Final text response
      const textContent = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      // Save assistant response to DB
      await prisma.aIChatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: "assistant",
          content: textContent,
        },
      });

      return NextResponse.json({
        response: textContent,
        conversationHistory: currentHistory,
        toolActions,
        toolsUsed: toolActions.length,
        sessionId: currentSessionId,
        usage: response.usage,
      });
    }

    return NextResponse.json({
      response: "Reached maximum processing iterations.",
      conversationHistory: currentHistory,
      toolActions,
      toolsUsed: toolActions.length,
      sessionId: currentSessionId,
    });
  } catch (error: any) {
    console.error("[ZicaAI] Route error:", error);
    
    let userFriendlyMsg = error.message;
    if (error.status === 404 || error.name === "NotFoundError") {
      userFriendlyMsg = "Model not found. Your API key might not have access to the latest Claude models yet.";
    } else if (error.status === 401) {
      userFriendlyMsg = "Invalid API key. Please check your settings.";
    }

    return NextResponse.json(
      { 
        error: userFriendlyMsg, 
        details: error.message,
        type: "server_error" 
      },
      { status: error.status || 500 }
    );
  }
}
