// ──────────────────────────────────────────────────
// /api/admin/claude — Main admin chat endpoint
// Secures admin capabilities using server-side NextAuth session,
// enforces max 8 tool loops, and filters error details.
// ──────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { resolvePrincipal } from "@/lib/ai/principal";
import { isToolAllowed } from "@/lib/ai/toolAllowList";
import { ZICA_TOOLS, type ClaudeMessage, type ClaudeContentBlock } from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import { callClaude, MAX_TOOL_LOOPS } from "@/lib/ai/claudeClient";
import { getAdminPrompt } from "@/lib/ai/prompts";
import prisma from "@/lib/db";
import { getAISettings } from "@/lib/ai-settings-util";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // 1. Resolve Principal (strictly server-side auth check)
    const principal = await resolvePrincipal(req as any);
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { message, conversationHistory = [], sessionId, pageContext, contextData, imageBase64, imageMimeType } = body as {
      message: string;
      conversationHistory: ClaudeMessage[];
      sessionId?: string;
      pageContext?: string;
      contextData?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!message?.trim() && !imageBase64) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // ─── Session Management ───
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const newSession = await prisma.aIChatSession.create({
        data: {
          title: (message || "Admin Query").slice(0, 50) + ((message || "").length > 50 ? "..." : ""),
        },
      });
      currentSessionId = newSession.id;
    }

    // Save user message
    await prisma.aIChatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: "user",
        content: message || "Image uploaded",
      },
    });

    // Build context-aware system prompt
    const aiSettings = getAISettings();
    let systemPrompt = getAdminPrompt();
    
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
    let currentHistory: Anthropic.MessageParam[] = conversationHistory.map(m => ({
      role: m.role,
      content: m.content as any,
    }));
    let iterations = 0;
    const toolActions: { tool: string; input: any; result: any; timestamp: string }[] = [];

    // Format user message input
    const userText = message || "Analyze this image";
    let userContent: any;
    if (imageBase64) {
      userContent = [
        { type: "image", source: { type: "base64", media_type: imageMimeType || "image/jpeg", data: imageBase64 } },
        { type: "text", text: userText },
      ];
    } else {
      userContent = userText;
    }
    currentHistory.push({ role: "user", content: userContent });

    while (iterations < MAX_TOOL_LOOPS) {
      iterations++;

      const result = await callClaude({
        systemPrompt,
        messages: currentHistory,
        tools: ZICA_TOOLS as any,
      });

      const response = result.response;

      if (response.stop_reason === "tool_use") {
        currentHistory.push({ role: "assistant", content: response.content as any });

        const toolResults: any[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
            console.log(`[ZicaAI] Tool: ${block.name}`, JSON.stringify(block.input).slice(0, 200));

            // Guard: double-check permission before executing
            if (!isToolAllowed(block.name, principal)) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ error: "Unauthorized tool execution" }),
                is_error: true,
              });
              continue;
            }

            const toolOutput = await executeClaudeTool(block.name, block.input || {}, principal);
            const parsedResult = JSON.parse(toolOutput);
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
              content: toolOutput,
              is_error: isError,
            });
          }
        }

        currentHistory.push({ role: "user", content: toolResults });
        continue;
      }

      // Final text response
      const textContent = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
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
      response: "Reached maximum tool processing iterations.",
      conversationHistory: currentHistory,
      toolActions,
      toolsUsed: toolActions.length,
      sessionId: currentSessionId,
    });
  } catch (error: any) {
    console.error("[ZicaAI Admin] Route error:", error);
    
    return NextResponse.json(
      { 
        error: "AI operation failed. Please try again.", 
        type: "server_error" 
      },
      { status: 500 }
    );
  }
}
