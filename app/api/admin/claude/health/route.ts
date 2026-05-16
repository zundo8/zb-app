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
    return NextResponse.json({ 
      status: "error", 
      message: error.message,
      code: "API_FAILURE" 
    }, { status: 500 });
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
