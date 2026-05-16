// ──────────────────────────────────────────────────
// /api/admin/claude — Main chat endpoint
// Proxies to Claude API with server-side key,
// handles tool_use agentic loops, returns final
// response + tracked tool actions for inline display.
// ──────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  callClaude,
  ZICA_SYSTEM_PROMPT,
  ZICA_TOOLS,
  type ClaudeMessage,
  type ClaudeContentBlock,
} from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";

export async function POST(req: Request) {
  try {
    if (!CLAUDE_API_KEY) {
      console.error("[ZicaAI Admin] Configuration Error: No API key found in process.env.");
      return NextResponse.json(
        { 
          error: "Claude API key not configured.", 
          details: "Set CLAUDE_API_KEY or ANTHROPIC_API_KEY in your environment variables.",
          type: "config_error" 
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { message, conversationHistory = [], sessionId, pageContext, contextData, overrideKey } = body as {
      message: string;
      conversationHistory: ClaudeMessage[];
      sessionId?: string;
      pageContext?: string;
      contextData?: string;
      overrideKey?: string;
    };

    const activeApiKey = overrideKey || CLAUDE_API_KEY;

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

    if (!message?.trim()) {
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
    let systemPrompt = ZICA_SYSTEM_PROMPT;
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

    // First iteration: send the user message
    currentHistory.push({ role: "user" as const, content: message });

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
        currentHistory.push({ role: "assistant" as const, content: response.content });

        const toolResults: ClaudeContentBlock[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
            console.log(`[ZicaAI] Tool: ${block.name}`, JSON.stringify(block.input).slice(0, 200));

            const result = await executeClaudeTool(block.name, block.input || {});

            toolActions.push({
              tool: block.name,
              input: block.input,
              result: JSON.parse(result),
              timestamp: new Date().toISOString(),
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
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
    return NextResponse.json(
      { error: error.message || "Internal server error", type: "server_error" },
      { status: 500 }
    );
  }
}
