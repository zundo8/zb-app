// ──────────────────────────────────────────────────
// /api/admin/claude/briefing — Trigger daily briefing
// Can be called manually or via cron job
// ──────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  callClaude,
  ZICA_SYSTEM_PROMPT,
  ZICA_TOOLS,
} from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";

export async function POST() {
  try {
    if (!CLAUDE_API_KEY) {
      return NextResponse.json({ error: "No API key" }, { status: 500 });
    }

    // Ask Claude to generate a briefing using its tools
    const briefingPrompt = `Generate a comprehensive morning briefing for the Zica Bella admin. Use the generate_daily_briefing tool to fetch all data, then present it as a structured, actionable summary. Include: key metrics, production status by stage, urgent tasks, low stock alerts, and recommended actions.`;

    let history: any[] = [{ role: "user", content: briefingPrompt }];
    let iterations = 0;
    let finalText = "";

    while (iterations < 6) {
      iterations++;
      const response = await callClaude({
        systemPrompt: ZICA_SYSTEM_PROMPT,
        userMessage: "",
        tools: ZICA_TOOLS,
        conversationHistory: history,
        apiKey: CLAUDE_API_KEY,
      });

      if (response.stop_reason === "tool_use") {
        history.push({ role: "assistant", content: response.content });
        const results: any[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use" && block.name && block.id) {
            const result = await executeClaudeTool(block.name, block.input || {});
            results.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }
        history.push({ role: "user", content: results });
        continue;
      }

      finalText = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");
      break;
    }

    return NextResponse.json({
      briefing: finalText,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint for easy cron trigger
export async function GET() {
  return POST();
}
