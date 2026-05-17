import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAppAuthFromRequest } from "@/lib/appAuth";
import { ZICA_USER_PROMPT, ZICA_ADMIN_PROMPT } from "@/lib/services/claudeService";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});



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

    const { messages } = body;
    const auth = getAppAuthFromRequest(req);
    const isAdmin = auth?.email?.endsWith('@zicabella.com') || false;
    const secureSystemPrompt = isAdmin ? ZICA_ADMIN_PROMPT : ZICA_USER_PROMPT;

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

    // Model selection — use env or hardcoded stable identifier
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: secureSystemPrompt,
      messages: sanitizedMessages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: text });
  } catch (error: any) {
    console.error("[Zica AI] Claude API error:", error?.status, error?.message || error);

    const statusCode = error?.status || 500;
    let userMessage = "Zica AI is temporarily unavailable. Please try again.";

    if (error?.message?.includes("authentication") || error?.message?.includes("api_key") || statusCode === 401) {
      userMessage = "Zica AI authentication failed. Please check your API key.";
    } else if (statusCode === 404 || error?.message?.includes("not_found")) {
      // 404 on all models typically means API key is expired, disabled, or has no billing
      userMessage = "Zica AI service is unavailable. The API key may need to be renewed.";
    } else if (error?.message?.includes("rate_limit") || error?.message?.includes("overloaded") || statusCode === 429 || statusCode === 529) {
      userMessage = "Zica AI is experiencing high demand. Please try again in a moment.";
    } else if (error?.message?.includes("credit") || error?.message?.includes("billing")) {
      userMessage = "Zica AI billing issue detected. Please check your Anthropic account.";
    }

    return NextResponse.json(
      { error: userMessage },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
    );
  }
}
