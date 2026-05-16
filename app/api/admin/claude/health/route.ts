import { NextResponse } from "next/server";
import { callClaude } from "@/lib/services/claudeService";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/** Resolve Claude API key: override → database → env */
async function resolveApiKey(overrideKey?: string): Promise<string> {
  if (overrideKey) return overrideKey;

  try {
    const shop = await prisma.shop.findFirst({
      select: { claudeApiKey: true },
    });
    if (shop?.claudeApiKey) return shop.claudeApiKey;
  } catch (e) {
    console.warn("[ZicaAI Health] Could not read DB key:", e);
  }

  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
}

export async function POST(req: Request) {
  let overrideKey: string | undefined;
  try {
    const body = await req.json();
    overrideKey = body.overrideKey;
  } catch { /* empty body is OK */ }

  const apiKey = await resolveApiKey(overrideKey);
  
  if (!apiKey) {
    return NextResponse.json({ 
      status: "error", 
      message: "No API key configured. Go to Settings → Zica AI to add your Claude API key.",
      code: "MISSING_KEY" 
    });
  }

  try {
    const test = await callClaude({
      systemPrompt: "Respond with OK",
      userMessage: "Health check",
      apiKey,
      tools: []
    });

    return NextResponse.json({ 
      status: "ok", 
      model: test.model,
      usage: test.usage 
    });
  } catch (error: any) {
    console.error("[ZicaAI Health] Error:", error);
    
    let userFriendlyMsg = error.message;
    if (error.status === 404 || error.name === "NotFoundError") {
      userFriendlyMsg = `Model not found or access denied. Your API key might not have access to the latest Claude models yet. Tried multiple fallbacks but all failed. Error: ${error.message}`;
    } else if (error.status === 401) {
      userFriendlyMsg = "Invalid API key. Please check your Anthropic API key in Settings.";
    }

    return NextResponse.json({ 
      status: "error", 
      message: userFriendlyMsg,
      code: "API_FAILURE",
      details: error.message
    }, { status: error.status || 500 });
  }
}

export async function GET() {
  const apiKey = await resolveApiKey();
  
  if (!apiKey) {
    return NextResponse.json({ 
      status: "error", 
      message: "No API key configured. Go to Settings → Zica AI to add your Claude API key.",
      code: "MISSING_KEY" 
    });
  }

  try {
    const test = await callClaude({
      systemPrompt: "Respond with OK",
      userMessage: "Health check",
      apiKey,
      tools: []
    });

    return NextResponse.json({ 
      status: "ok", 
      model: test.model,
      usage: test.usage 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: "error", 
      message: error.message,
      code: "API_FAILURE" 
    }, { status: 500 });
  }
}
