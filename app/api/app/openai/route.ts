import { NextRequest } from "next/server";
import { getAppAuthFromRequest, resolveAuthCustomer } from "@/lib/appAuth";
import prisma from "@/lib/db";
import OpenAI from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Isolated User-Side OpenAI client resolver
async function resolveOpenAIKey() {
  try {
    const shop = await prisma.shop.findFirst({
      select: { openaiApiKey: true }
    });
    if (shop?.openaiApiKey && !shop.openaiApiKey.startsWith('sk-proj-R5x6e8X')) {
      return shop.openaiApiKey;
    }
  } catch (err) {
    console.error("[Zica User OpenAI] Failed to fetch key from DB:", err);
  }
  return process.env.OPENAI_API_KEY || "";
}

export async function POST(req: NextRequest) {
  try {
    const activeKey = await resolveOpenAIKey();
    if (!activeKey || activeKey.includes("placeholder") || activeKey.startsWith("sk-proj-xxxx")) {
      console.error("[Zica User OpenAI] Configuration Error: Real OpenAI API Key is not set.");
      return new Response(JSON.stringify({ error: "Zica AI is temporarily offline. Please try again later." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = new OpenAI({
      apiKey: activeKey,
    });

    const body = await req.json().catch(() => null);
    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "Invalid request: messages array required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, sessionId, userContext, orderIdContext } = body;
    const auth = getAppAuthFromRequest(req);
    const customer = auth ? await resolveAuthCustomer(auth) : null;
    const userId = customer?.id || userContext?.id;

    // 1. Resolve Session ID (Ensure secure private session storage)
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const session = await prisma.aIChatSession.create({
          data: {
            userId: userId || null,
            title: (messages[messages.length - 1]?.content || "Image analysis").substring(0, 50),
          }
        });
        currentSessionId = session.id;
      } catch (err) {
        console.error("[Zica User OpenAI] Failed to create chat session:", err);
      }
    }

    // 2. Save User message to history securely
    const lastUserMsg = messages[messages.length - 1];
    if (currentSessionId && lastUserMsg) {
      try {
        await prisma.aIChatMessage.create({
          data: {
            sessionId: currentSessionId,
            role: "user",
            content: typeof lastUserMsg.content === "string" 
              ? lastUserMsg.content 
              : Array.isArray(lastUserMsg.content) 
                ? lastUserMsg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ") || "Analyze image"
                : "Analyze image"
          }
        });
      } catch (err) {
        console.error("[Zica User OpenAI] Failed to save user message:", err);
      }
    }

    // 3. Build Private, Isolated User-Side System Prompt
    let systemPrompt = `You are Zica, the intelligent personal fashion AI for Zica Bella — a premium Indian streetwear brand focused on oversized silhouettes, graphic tees, acid-wash apparel, baggy denim, statement accessories, and bold urban styling. All apparel products are designed to be unisex.

RESPONSE RULES:
1. Always be concise, warm, and fashion-forward in tone.
2. When referencing any product, format it as: [Product Name](zicabella://product/{handle})
3. When referencing any collection, format it as: [Collection Name](zicabella://collection/{handle})
4. When asked about tees, t-shirts, graphic tees, acid wash, printed tops, casual wear, or any related category, always lead your response by referencing the Acid Tees collection first: [Acid Tees Collection](zicabella://collection/acid-tees). Then proceed with other relevant suggestions.
5. For styling tips: give 2-3 specific, actionable tips with outfit combinations.
6. For size queries: Zica Bella is designed around an oversized streetwear fit. For a true oversized look, suggest the customer's standard size. For a more fitted relaxed look, suggest one size down. If more detail is needed, advise the customer to check the size guide on the product page.
7. Never hallucinate products — only reference products you are certain exist in the Zica Bella catalogue.
8. Keep responses under 180 words unless the user asks for detail.
9. You are not connected to any admin or internal system and do not share information between users.
10. Under every product recommendation, ALWAYS offer a direct action to add to cart like this: [Add to Bag 🛍️](zicabella://cart/add/handle).

USER SAFETY AND ORDER RULES:
- You may discuss only the customer's own orders, general product information, returns/exchanges, fabric care, sizing, occasion dressing, and styling advice.
- Never reveal or reference manufacturing stages, internal inventory counts, warehouse data, vendor names, sourcing, cost prices, margins, internal order IDs, Shopify admin references, or other users' data.
- When asked about order status, use only these customer-facing statuses: Order Placed, Processing, Ready for Dispatch, Shipped / Out for Delivery, Delivered, Return / Exchange Requested, Cancelled.
- Never fabricate order status, tracking numbers, delivery dates, product availability, or catalogue entries.
- Never expose raw Shopify, checkout, myshopify.com, or admin URLs.

STORE CONTEXT:
- Shipping across India is free; delivery usually takes 3 to 7 business days depending on location.
- Eligible returns and exchanges can be initiated in the app within 7 days of delivery when items are unworn, unwashed, and have original tags attached.`;

    // 4. Securely fetch ONLY Customer's own orders context (Prevents Admin leaks)
    if (userId) {
      try {
        const recentOrders = await prisma.order.findMany({
          where: {
            customerId: userId,
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
          systemPrompt += `\n\nCustomer's Recent Orders:\n${recentOrders.map(o => 
            `- Order #${o.shopifyOrderId.replace(/^#/, "")} (${o.id}): ₹${o.totalPrice}, Status: ${o.status}, Payment: ${o.paymentStatus}, Delivery: ${o.deliveryStatus}, Date: ${o.createdAt.toLocaleDateString()}`
          ).join("\n")}`;
          
          systemPrompt += `\n\nIf the customer asks "Where is my order?" or "Track my order", refer to these orders.`;
        }
      } catch (err) {
        console.error("[Zica User OpenAI] Failed to fetch customer orders context:", err);
      }
    }

    // 5. Securely fetch products catalog context
    try {
      const allProducts = await prisma.product.findMany({
        select: { title: true, price: true, handle: true, featuredImage: true },
        take: 50
      });

      if (allProducts.length > 0) {
        systemPrompt += `\n\nZica Bella Product Catalog:\n`;
        systemPrompt += allProducts.map(p => 
          `- ${p.title}: ₹${p.price || 'N/A'}. Handle: ${p.handle}. Image: ${p.featuredImage || ''}`
        ).join("\n");
      }
    } catch (err) {
      console.error("[Zica User OpenAI] Failed to fetch products context:", err);
    }

    if (orderIdContext) {
      systemPrompt += `\n\nThe customer is currently viewing order ID: ${orderIdContext}. Focus on this order if they ask general questions.`;
    }

    // 6. Format messages for OpenAI API (Handles standard text and image multi-part inputs)
    const formattedMessages = messages.map((msg: any) => {
      let content = msg.content;
      if (Array.isArray(content)) {
        content = content.map((block: any) => {
          if (block.type === "image") {
            return {
              type: "image_url",
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`
              }
            };
          }
          return {
            type: "text",
            text: block.text
          };
        });
      }
      return {
        role: msg.role === "assistant" ? "assistant" : "user",
        content
      };
    });

    const openAIModel = process.env.OPENAI_MODEL || "gpt-4o";

    // 7. Request streaming completion from OpenAI
    const openAIResponse = await openai.chat.completions.create({
      model: openAIModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...formattedMessages
      ],
      stream: true,
      max_tokens: 1024,
    });

    // 8. Stream the response back in chunked SSE format compatible with the client-side parser
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        let fullResponseText = "";
        try {
          for await (const chunk of openAIResponse) {
            const token = chunk.choices[0]?.delta?.content || "";
            if (token) {
              fullResponseText += token;
              const dataString = `data: ${JSON.stringify({
                type: "content_block_delta",
                delta: { text: token }
              })}\n\n`;
              controller.enqueue(encoder.encode(dataString));
            }
          }

          // Save complete Assistant response to database securely
          if (currentSessionId && fullResponseText.trim()) {
            await prisma.aIChatMessage.create({
              data: {
                sessionId: currentSessionId,
                role: "assistant",
                content: fullResponseText
              }
            });
          }
        } catch (streamErr) {
          console.error("[Zica User OpenAI] Streaming error:", streamErr);
          const dataString = `data: ${JSON.stringify({ type: "error", error: { message: "AI response stream interrupted." } })}\n\n`;
          controller.enqueue(encoder.encode(dataString));
        } finally {
          const doneString = `data: ${JSON.stringify({ type: "message_stop", sessionId: currentSessionId })}\n\n`;
          controller.enqueue(encoder.encode(doneString));
          controller.close();
        }
      }
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    });

  } catch (error: any) {
    console.error("[Zica User OpenAI] Route Exception:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
