/**
 * POST /api/app/claude — Mobile-specific Claude AI endpoint
 * 
 * Injects user context (name, orders) into the system prompt
 * for a personalized concierge experience.
 * 
 * Public endpoint (no admin session required), but ideally
 * should validate a user token in production.
 */

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
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
    }

    const body = await req.json();
    const { 
      message, 
      conversationHistory = [], 
      userContext, 
      orderIdContext,
      sessionId
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = await prisma.aIChatSession.create({
        data: {
          userId: userContext?.id || null,
          title: message.substring(0, 50),
        }
      });
      currentSessionId = session.id;
    }

    await prisma.aIChatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: "user",
        content: message
      }
    });

    let systemPrompt = ZICA_SYSTEM_PROMPT;
    
    if (userContext?.name) {
      systemPrompt += `\n\nYou are talking to the customer "${userContext.name}".`;
    }
    
    if (userContext?.id || userContext?.email || userContext?.phone) {
      try {
        const recentOrders = await prisma.order.findMany({
          where: {
            OR: [
              userContext.id ? { customerId: userContext.id } : null,
              userContext.email ? { customer: { email: userContext.email } } : null,
              userContext.phone ? { customer: { phone: userContext.phone } } : null,
            ].filter(Boolean) as any,
          },
          take: 3,
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
          systemPrompt += `\n\nCustomer's Recent Orders:\n${recentOrders.map(o => 
            `- Order #${o.shopifyOrderId.replace(/^#/, "")} (${o.id}): ₹${o.totalPrice}, Status: ${o.status}, Payment: ${o.paymentStatus}, Delivery: ${o.deliveryStatus}, Date: ${o.createdAt.toLocaleDateString()}`
          ).join("\n")}`;
          
          systemPrompt += `\n\nIf the customer asks "Where is my order?" or "Track my order", refer to these orders. Use get_shipment_details(order_id) for real-time tracking if they ask about a specific one.`;
        }
        
        // Load recent chat knowledge base for this user
        const previousChats = await prisma.aIChatMessage.findMany({
          where: { session: { userId: userContext.id } },
          orderBy: { createdAt: "desc" },
          take: 10
        });
        
        if (previousChats.length > 0) {
           systemPrompt += `\n\nPast interactions with this user (for context and learning):\n${previousChats.reverse().map(c => `${c.role}: ${c.content}`).join("\n")}`;
        }
      } catch (err) {
        console.error("[ZicaAI Mobile] Failed to fetch context:", err);
      }
    }

    // Knowledge base from other interactions
    try {
        const globalChats = await prisma.aIChatMessage.findMany({
          where: { role: "user" },
          orderBy: { createdAt: "desc" },
          take: 5
        });
        if (globalChats.length > 0) {
          systemPrompt += `\n\nRecent queries from all users (Use this to understand app usage trends and learn):\n${globalChats.map(c => `- ${c.content}`).join("\n")}`;
        }
    } catch(e) {}

    if (orderIdContext) {
      systemPrompt += `\n\nThe customer is currently viewing order ID: ${orderIdContext}. Focus on this order if they ask general questions.`;
    }

    let currentHistory: ClaudeMessage[] = [...conversationHistory];
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    const toolActions: any[] = [];

    currentHistory.push({ role: "user" as const, content: message });

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await callClaude({
        systemPrompt,
        userMessage: "", 
        tools: ZICA_TOOLS,
        conversationHistory: currentHistory,
        apiKey: CLAUDE_API_KEY,
      });

      if (response.stop_reason === "tool_use") {
        currentHistory.push({ role: "assistant" as const, content: response.content });
        const toolResults: ClaudeContentBlock[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
            const result = await executeClaudeTool(block.name, block.input || {});
            
            toolActions.push({ tool: block.name, input: block.input });

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

      const textContent = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      currentHistory.push({ role: "assistant" as const, content: textContent });

      await prisma.aIChatMessage.create({
        data: {
          sessionId: currentSessionId,
          role: "assistant",
          content: textContent
        }
      });

      return NextResponse.json({
        response: textContent,
        conversationHistory: currentHistory,
        toolsUsed: toolActions.length,
        sessionId: currentSessionId
      });
    }

    const fallbackResponse = "I'm having trouble processing that right now. How else can I help?";
    await prisma.aIChatMessage.create({
      data: { sessionId: currentSessionId, role: "assistant", content: fallbackResponse }
    });

    return NextResponse.json({
      response: fallbackResponse,
      conversationHistory: currentHistory,
      sessionId: currentSessionId
    });
  } catch (error: any) {
    console.error("[ZicaAI Mobile] Route error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
