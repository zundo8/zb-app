import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveOpenAIKey() {
  try {
    const shop = await prisma.shop.findFirst({
      select: { openaiApiKey: true }
    });
    if (shop?.openaiApiKey && !shop.openaiApiKey.startsWith('sk-proj-R5x6e8X')) {
      return shop.openaiApiKey;
    }
  } catch (err) {
    console.error("[Zica User OpenAI TTS] Failed to fetch key from DB:", err);
  }
  return process.env.OPENAI_API_KEY || "";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text");
    
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text parameter is required" }, { status: 400 });
    }

    const activeKey = await resolveOpenAIKey();
    if (!activeKey || activeKey.includes("placeholder") || activeKey.startsWith("sk-proj-xxxx")) {
      console.warn("[Zica User OpenAI TTS] Configuration Error: Real OpenAI API Key is not set.");
      return NextResponse.json({ error: "Text-to-speech service is offline" }, { status: 503 });
    }

    // Call OpenAI TTS API endpoint
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${activeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.substring(0, 400), // Enforce reasonable length limit for instant mobile playback
        voice: "nova", // Nova voice has a premium, professional, fashion-forward tone
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Zica User OpenAI TTS Error]", err);
      return NextResponse.json({ error: "Failed to generate speech" }, { status: response.status });
    }

    // Pipe the response binary MP3 directly
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[Zica User OpenAI TTS Exception]", error);
    return NextResponse.json({ error: error.message || "Failed to process TTS request" }, { status: 500 });
  }
}
