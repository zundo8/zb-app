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
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array required" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: text });
  } catch (error: any) {
    console.error("[Zica AI] Claude API error:", error?.message || error);
    return NextResponse.json(
      { error: "Zica AI is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
