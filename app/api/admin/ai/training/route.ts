import { NextRequest, NextResponse } from "next/server";
import { getAISettings, saveAISettings } from "@/lib/ai-settings-util";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = getAISettings();
    const rules = settings.trainingRules || [];
    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch training rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt instruction is required" },
        { status: 400 }
      );
    }

    const settings = getAISettings();
    if (!settings.trainingRules) {
      settings.trainingRules = [];
    }

    const newRule = {
      id: "rule_" + Math.random().toString(36).substring(2, 11),
      prompt: prompt.trim(),
      createdAt: new Date().toISOString(),
    };

    settings.trainingRules.push(newRule);
    const success = saveAISettings(settings);
    if (!success) {
      throw new Error("Failed to save rules to settings store");
    }

    return NextResponse.json({ success: true, rule: newRule, rules: settings.trainingRules });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save training rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Rule ID is required" },
        { status: 400 }
      );
    }

    const settings = getAISettings();
    if (!settings.trainingRules) {
      settings.trainingRules = [];
    }

    const initialLength = settings.trainingRules.length;
    settings.trainingRules = settings.trainingRules.filter(r => r.id !== id);

    if (settings.trainingRules.length === initialLength) {
      return NextResponse.json(
        { success: false, error: "Rule not found" },
        { status: 404 }
      );
    }

    const success = saveAISettings(settings);
    if (!success) {
      throw new Error("Failed to save rules to settings store");
    }

    return NextResponse.json({ success: true, rules: settings.trainingRules });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete training rule" },
      { status: 500 }
    );
  }
}
