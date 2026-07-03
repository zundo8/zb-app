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
  ZICA_USER_PROMPT,
  ZICA_ADMIN_PROMPT,
  ZICA_TOOLS,
  type ClaudeMessage,
  type ClaudeContentBlock,
} from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import prisma from "@/lib/db";
import { getAISettings } from "@/lib/ai-settings-util";
import { getAppAuthFromRequest } from "@/lib/appAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Resolve Claude API key: dedicated user-side env keys first → database → generic env keys */
async function resolveApiKey(): Promise<string> {
  const userKey = process.env.EXPO_PUBLIC_CLAUDE_API_KEY || process.env.CLAUDE_USER_API_KEY || process.env.CLAUDE_API_KEY_USER;
  if (userKey) return userKey;

  try {
    const shop = await prisma.shop.findFirst({
      select: { claudeApiKey: true },
    });
    if (shop?.claudeApiKey) return shop.claudeApiKey;
  } catch (e) {
    console.warn("[ZicaAI Mobile] Could not read DB key:", e);
  }
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
}

export async function POST(req: Request) {
  try {
    const CLAUDE_API_KEY = await resolveApiKey();
    
    if (!CLAUDE_API_KEY) {
      console.error("[ZicaAI Mobile] Configuration Error: No API key found.");
      return NextResponse.json({ error: "Service unavailable (Config Error)" }, { status: 500 });
    }

    const body = await req.json();
    const { 
      message, 
      conversationHistory = [], 
      userContext, 
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
          userId: userContext?.id || null,
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

    const auth = getAppAuthFromRequest(req);
    const aiSettings = getAISettings();
    const isAdmin = false;
    const settings = aiSettings.user;

    let systemPrompt = ZICA_USER_PROMPT;

    // Secure & sanitize userContext to prevent spoofing of admin emails or user contexts
    const customerEmail = auth?.customerEmail || (userContext?.email && !userContext.email.endsWith('@zicabella.com') ? userContext.email : null);
    const sanitizedUserContext = {
      id: auth?.customerId || userContext?.id || null,
      name: userContext?.name || null,
      phone: auth?.customerPhone || userContext?.phone || null,
      email: customerEmail,
    };

    if (aiSettings.trainingRules && aiSettings.trainingRules.length > 0) {
      systemPrompt += `\n\nADDITIONAL DYNAMIC KNOWLEDGE & MEMORY:\nYou have been trained with the following additional custom operational instructions and knowledge. You MUST follow them strictly:\n`;
      aiSettings.trainingRules.forEach((rule: any, idx: number) => {
        systemPrompt += `- ${rule.prompt}\n`;
      });
    }

    if (settings.allowedPages && settings.allowedPages.length > 0) {
      systemPrompt += `\n\nCRITICAL CONTEXT - ALLOWED NAVIGATION PAGES: You are only allowed to refer to, recommend, or direct the user to the following pages or sections: ${settings.allowedPages.join(", ")}. Do NOT mention, suggest, or try to navigate the user to any other sections outside of this list.`;
    }
    
    if (userContext?.name) {
      systemPrompt += `\n\nYou are talking to the customer "${userContext.name}".`;
    }
    
    if (userContext?.id || userContext?.email || userContext?.phone) {
      try {
        const recentOrders = await prisma.order.findMany({
          where: {
            AND: [
              {
                OR: [
                  userContext.id ? { customerId: userContext.id } : null,
                  userContext.email ? { customer: { email: userContext.email } } : null,
                  userContext.phone ? { customer: { phone: userContext.phone } } : null,
                ].filter(Boolean) as any,
              },
              {
                status: {
                  notIn: ['cancelled', 'CANCELLED', 'failed', 'FAILED']
                }
              },
              {
                paymentStatus: {
                  notIn: ['failed', 'FAILED', 'cancelled', 'CANCELLED']
                }
              }
            ]
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
            `- Order #${o.shopifyOrderId.replace(/^#/, "")} (${o.id}): ₹${o.totalPrice}, Status: ${o.status}, Payment: ${o.paymentStatus}, Delivery: ${o.deliveryStatus}, Date: ${o.createdAt.toLocaleDateString()}`
          ).join("\n")}`;
          
          systemPrompt += `\n\nIf the customer asks "Where is my order?" or "Track my order", refer to these orders. Use get_shipment_details(order_id) for real-time tracking if they ask about a specific one.`;
        }
      } catch (err) {
        console.error("[ZicaAI Mobile] Failed to fetch context:", err);
      }
    }

    // --- INJECT PRODUCT KNOWLEDGE ---
    try {
      const allProducts = await prisma.product.findMany({
        select: { title: true, price: true, handle: true, featuredImage: true },
        take: 50 // Limit to avoid prompt bloat, though usually small
      });

      const shop = await prisma.shop.findFirst({
        select: { 
          spotlightCollection: true, 
          kineticMeshTitle: true, 
          ringCarouselTitle: true,
          archiveTitle: true,
        }
      });

      if (allProducts.length > 0) {
        systemPrompt += `\n\nZica Bella Product Catalog:\n`;
        systemPrompt += `You have full access to our products. When a user asks for recommendations, shopping, or style advice, refer to these products.\n`;
        systemPrompt += `CRITICAL: You MUST use Markdown image syntax to display products and collections beautifully! Example: ![Product Name](image_url)\n`;
        systemPrompt += `Note: To optimize images for mobile, append '&width=600' (if url has '?') or '?width=600' to the image URLs.\n\n`;
        systemPrompt += `CRITICAL NAVIGATION & ACTION INSTRUCTIONS for mobile app:\n`;
        systemPrompt += `- ALWAYS link products using this exact scheme: [View Product](zica://products/handle)\n`;
        systemPrompt += `- ALWAYS link collections using this exact scheme: [View Collection](zica://collections/handle)\n`;
        systemPrompt += `- Under every product recommendation, ALWAYS offer a direct action to add to cart like this: [Add to Bag 🛍️](zica://cart/add/handle). Make sure to present this action clearly so the user can add the item directly from the chat screen!\n\n`;
        
        systemPrompt += allProducts.map((p: any) => 
          `- ${p.title}: ₹${p.price || 'N/A'}. View Link: zica://products/${p.handle || ''}. Add to Bag Link: zica://cart/add/${p.handle || ''}. Image: ${p.featuredImage || ''}`
        ).join("\n");

        systemPrompt += `\n\nZica Bella Collections:\n`;
        systemPrompt += `- Spotlight / T-Shirts: zica://collections/${shop?.spotlightCollection || 't-shirts'}\n`;
        systemPrompt += `- Archive Edition: zica://collections/${shop?.kineticMeshTitle || 'archive'}\n`;
        systemPrompt += `- Rings Collection: zica://collections/${shop?.ringCarouselTitle || 'rings'}\n`;
        systemPrompt += `Recommend collections by grouping products that fit these themes. Always use the zica://collections/handle scheme to link them.\n`;
      }
    } catch (err) {
      console.error("[ZicaAI Mobile] Failed to fetch products for catalog context:", err);
    }

    if (orderIdContext) {
      systemPrompt += `\n\nThe customer is currently viewing order ID: ${orderIdContext}. Focus on this order if they ask general questions.`;
    }

    let currentHistory: ClaudeMessage[] = [...conversationHistory];
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    const toolActions: any[] = [];

    // Build user content — supports image + text multi-part messages
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

    const availableTools = ZICA_TOOLS.filter(t => settings.enabledTools.includes(t.name));

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await callClaude({
        systemPrompt,
        userMessage: "", 
        tools: availableTools,
        conversationHistory: currentHistory,
        apiKey: CLAUDE_API_KEY,
      });

      if (response.stop_reason === "tool_use") {
        currentHistory.push({ role: "assistant" as const, content: response.content as ClaudeContentBlock[] });
        const toolResults: ClaudeContentBlock[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
            const result = await executeClaudeTool(block.name, block.input || {}, sanitizedUserContext);
            
            const parsedResult = JSON.parse(result);
            const isError = parsedResult.error !== undefined;
            
            toolActions.push({ tool: block.name, input: block.input });

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
