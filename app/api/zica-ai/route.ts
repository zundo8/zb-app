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

    // Use the model from env or default to claude-3-5-sonnet-latest
    const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: secureSystemPrompt,
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
