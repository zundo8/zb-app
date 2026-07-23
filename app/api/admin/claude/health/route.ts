import { NextResponse } from "next/server";
import { checkModelHealth } from "@/lib/ai/claudeClient";
import { getAllModelIds } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

async function runHealthChecks() {
  const modelIds = getAllModelIds();
  const results: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};
  let overallOk = true;

  for (const modelId of modelIds) {
    const res = await checkModelHealth(modelId);
    results[modelId] = res;
    if (!res.ok) {
      overallOk = false;
    }
  }

  return {
    status: overallOk ? "ok" : "degraded",
    models: results,
    timestamp: new Date().toISOString(),
  };
}

export async function POST() {
  try {
    const health = await runHealthChecks();
    return NextResponse.json(health);
  } catch (error: any) {
    console.error("[ZicaAI Health] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Health check failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const health = await runHealthChecks();
    return NextResponse.json(health);
  } catch (error: any) {
    console.error("[ZicaAI Health] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Health check failed" },
      { status: 500 }
    );
  }
}
