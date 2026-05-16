import { NextResponse } from "next/server";
import { callClaude } from "@/lib/services/claudeService";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      status: "error", 
      message: "API Key missing in environment variables.",
      code: "MISSING_KEY" 
    });
  }

  try {
    // Simple test call to verify key and model
    const test = await callClaude({
      systemPrompt: "Respond with 'OK'",
      userMessage: "Health check",
      apiKey: apiKey,
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
