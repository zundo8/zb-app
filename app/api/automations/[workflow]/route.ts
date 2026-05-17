// ──────────────────────────────────────────────────
// /api/automations/[workflow] — Cron-triggered automations
// Vercel Cron or external scheduler calls these
// ──────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  callClaude,
  ZICA_ADMIN_PROMPT,
  ZICA_TOOLS,
} from "@/lib/services/claudeService";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";

const WORKFLOW_PROMPTS: Record<string, string> = {
  "morning-briefing": `Generate a comprehensive morning briefing. Use generate_daily_briefing to fetch all data, then create a structured summary. After generating the briefing, use send_email_notification (type: 'daily_briefing') to send the full report to the admin team via Zoho Mail, and also use send_push_notification for a quick "Good morning! ☀️" mobile alert.`,

  "low-stock-alert": `Check inventory levels using get_fabric_inventory and get_low_stock_products. If any items are critically low (below threshold), create reorder requests using create_reorder_request for the most urgent items. Then send a push notification AND an email notification (type: 'low_stock') alerting the admin about the low stock situation with details of the affected items.`,

  "production-bottleneck": `Check all production batches using get_production_batches. Identify any stage where batches have been stuck for more than 24 hours (compare updatedAt timestamps). If bottlenecks are found, create urgent tasks for each one. Send a push notification AND a detailed email notification (type: 'custom') to the admin team flagging these bottlenecks and suggesting next actions.`,

  "order-sla-monitor": `Check all orders using get_orders_summary with a limit of 50. Flag any orders that have been in 'pending' or 'processing' status for more than 48 hours (check ageHours). For flagged orders, create follow-up tasks and optionally update their status to reflect urgency. Send a push notification AND an email notification (type: 'custom') listing these orders for immediate attention.`,

  "evening-summary": `Generate an end-of-day summary. Use the dashboard summary and production data to report on: orders processed today, production stages completed, tasks finished, and estimated revenue. Send a push notification AND an email notification (type: 'custom') to the admin team with the evening summary.`,
};

async function runWorkflow(workflowId: string) {
  const prompt = WORKFLOW_PROMPTS[workflowId];
  if (!prompt) {
    return { error: `Unknown workflow: ${workflowId}`, validWorkflows: Object.keys(WORKFLOW_PROMPTS) };
  }

  let history: any[] = [{ role: "user", content: prompt }];
  let iterations = 0;
  let finalText = "";
  const actionsPerformed: string[] = [];

  while (iterations < 8) {
    iterations++;
    const response = await callClaude({
      systemPrompt: ZICA_ADMIN_PROMPT + "\n\nYou are running in AUTOMATED mode as a scheduled workflow. Take actions directly — do not ask for confirmation.",
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
          actionsPerformed.push(block.name);
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

  return {
    workflow: workflowId,
    result: finalText,
    actionsPerformed,
    iterations,
    completedAt: new Date().toISOString(),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ workflow: string }> }) {
  try {
    if (!CLAUDE_API_KEY) {
      return NextResponse.json({ error: "No API key configured" }, { status: 500 });
    }

    const { workflow } = await params;
    const result = await runWorkflow(workflow);
    
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ workflow: string }> }) {
  return GET(req, { params });
}
