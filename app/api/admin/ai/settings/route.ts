import { NextRequest, NextResponse } from "next/server";
import { getAISettings, saveAISettings } from "@/lib/ai-settings-util";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = getAISettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { settings } = body;

    if (!settings || !settings.admin || !settings.user) {
      return NextResponse.json(
        { success: false, error: "Invalid settings payload" },
        { status: 400 }
      );
    }

    const success = saveAISettings(settings);
    if (!success) {
      throw new Error("Failed to write settings to file");
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save settings" },
      { status: 500 }
    );
  }
}
