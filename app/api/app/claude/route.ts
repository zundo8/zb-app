/**
 * POST /api/app/claude — Mobile / App Claude AI endpoint
 * 
 * Uses server-derived Principal (customer token or guest),
 * applies customer tool allow-lists, output guards, and rate limits.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolvePrincipal } from "@/lib/ai/principal";
import { filterToolsForPrincipal, isToolAllowed } from "@/lib/ai/toolAllowList";
import { getPromptForPrincipal } from "@/lib/ai/prompts";
import { applyOutputGuard } from "@/lib/ai/outputGuard";
import { wrapUntrustedData } from "@/lib/ai/sanitize";
import { ZICA_TOOLS, type ClaudeMessage } from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import { callClaude, MAX_TOOL_LOOPS } from "@/lib/ai/claudeClient";
import { checkRateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Rate limiting: 20 req/min for authenticated customer, 5 req/min for guest IP
  const principal = await resolvePrincipal(req);
  const rateLimitKey = principal.kind === "customer" ? `ai:customer:${principal.customerId}` : "ai:guest";
  const rateLimitMax = principal.kind === "customer" ? 20 : 5;

  const rateLimitResult = await checkRateLimit(req, rateLimitKey, { maxRequests: rateLimitMax, windowMs: 60_000 });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const body = await req.json();
    const { 
      message, 
      conversationHistory = [], 
      orderIdContext,
      sessionId,
      imageBase64,
      imageMimeType
    } = body;

    if (!message?.trim() && !imageBase64) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = await prisma.aIChatSession.create({
        data: {
          userId: principal.kind === "customer" ? principal.customerId : null,
          title: (message || "Image analysis").substring(0, 50),
        }
      });
      currentSessionId = session.id;
    }

    await prisma.aIChatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: "user",
        content: message || "Analyze this image"
      }
    });

    let systemPrompt = getPromptForPrincipal(principal.kind);

    // Inject customer orders context if logged in
    if (principal.kind === "customer") {
      try {
        const recentOrders = await prisma.order.findMany({
          where: {
            customerId: principal.customerId,
            status: { notIn: ['cancelled', 'CANCELLED', 'failed', 'FAILED'] },
            paymentStatus: { notIn: ['failed', 'FAILED', 'cancelled', 'CANCELLED'] }
          },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            shopifyOrderId: true,
            totalPrice: true,
            status: true,
            paymentStatus: true,
            deliveryStatus: true,
            createdAt: true,
          }
        });

        if (recentOrders.length > 0) {
          systemPrompt += `\n\nCustomer's Recent Orders:\n${recentOrders.map((o: any) => 
            `- Order #${o.shopifyOrderId ? o.shopifyOrderId.replace(/^#/, "") : o.id.slice(-6)} (${o.id}): ₹${o.totalPrice}, Status: ${o.status}, Delivery: ${o.deliveryStatus}, Date: ${o.createdAt.toLocaleDateString()}`
          ).join("\n")}`;
          
          systemPrompt += `\n\nIf the customer asks "Where is my order?" or "Track my order", refer to these orders.`;
        }
      } catch (err) {
        console.error("[ZicaAI App] Failed to fetch customer orders context:", err);
      }
    }

    // Inject catalog context
    try {
      const allProducts = await prisma.product.findMany({
        select: { title: true, price: true, handle: true, featuredImage: true },
        take: 30
      });

      if (allProducts.length > 0) {
        systemPrompt += `\n\nZica Bella Catalogue:\n`;
        systemPrompt += allProducts.map((p: any) => 
          `- ${wrapUntrustedData(p.title)}: ₹${p.price || 'N/A'}. Handle: ${p.handle || ''}`
        ).join("\n");
      }
    } catch (err) {
      console.error("[ZicaAI App] Failed to fetch catalog context:", err);
    }

    if (orderIdContext) {
      systemPrompt += `\n\nThe customer is viewing order ID: ${orderIdContext}.`;
    }

    // Filter tools based on principal kind (customer vs guest)
    const allowedTools = filterToolsForPrincipal(ZICA_TOOLS as any, principal);

    let currentHistory: Anthropic.MessageParam[] = conversationHistory.map((m: ClaudeMessage) => ({
      role: m.role,
      content: m.content as any,
    }));
    let iterations = 0;
    const toolActions: any[] = [];

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
        tools: allowedTools as Anthropic.Tool[],
      });

      const response = result.response;

      if (response.stop_reason === "tool_use") {
        currentHistory.push({ role: "assistant", content: response.content as any });
        const toolResults: any[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
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
      const rawText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
        .join("\n");

      // Apply Output Guard to check for internal leaks
      const safeText = applyOutputGuard(rawText, "app");

      // Save assistant response to DB
      await prisma.aIChatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: "assistant",
          content: safeText,
        },
      });

      return NextResponse.json({
        response: safeText,
        conversationHistory: currentHistory,
        toolActions,
        sessionId: currentSessionId,
      });
    }

    return NextResponse.json({
      response: "Thank you for chatting with Zica AI!",
      conversationHistory: currentHistory,
      sessionId: currentSessionId,
    });
  } catch (error: any) {
    console.error("[ZicaAI App] Route Exception:", error);
    return NextResponse.json(
      { error: "Zica AI is temporarily unavailable. Please try again later." },
      { status: 500 }
    );
  }
}
