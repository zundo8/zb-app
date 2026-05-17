import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Zica AI, a personal fashion stylist for Zica Bella — a premium fashion brand.
You help customers with:
- Outfit recommendations and styling advice tailored to their style and occasion
- Size guidance based on their measurements and body type
- Product discovery (e.g. "show me something for a beach wedding")
- Fabric care instructions and material information
- General fashion tips and trend advice

Keep responses warm, concise, and fashion-forward. Use friendly, conversational language.
If asked about order status or account details, let the user know they can check the Orders tab.
Never invent product names, SKUs, or prices.`;

export async function POST(req: NextRequest) {
  try {
    // Validate API key is present
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[Zica AI] ANTHROPIC_API_KEY is not set in environment variables.");
      return NextResponse.json(
        { error: "Zica AI is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array required" },
        { status: 400 }
      );
    }

    const { messages, systemPrompt } = body;

    // Sanitize messages — ensure all content is text-only for server-side processing
    const sanitizedMessages = messages.map((msg: any) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join(" ") || "Hello"
          : String(msg.content || "Hello"),
    }));

    // Use the model from env or default to claude-sonnet-4-6
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt || SYSTEM_PROMPT,
      messages: sanitizedMessages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: text });
  } catch (error: any) {
    console.error("[Zica AI] Claude API error:", error?.message || error);

    // Provide more specific error messages
    const statusCode = error?.status || 500;
    let userMessage = "Zica AI is temporarily unavailable. Please try again.";

    if (error?.message?.includes("authentication") || error?.message?.includes("api_key")) {
      userMessage = "Zica AI authentication failed. Please contact support.";
    } else if (error?.message?.includes("model")) {
      userMessage = "Zica AI model configuration error. Please contact support.";
    } else if (error?.message?.includes("rate_limit") || error?.message?.includes("overloaded")) {
      userMessage = "Zica AI is experiencing high demand. Please try again in a moment.";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
    );
  }
}
