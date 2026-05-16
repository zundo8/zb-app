import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.CLAUDE_WEBHOOK_SECRET || "";

/**
 * Verifies the signature from Anthropic
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = hmac.update(payload).digest("hex");
    
    // Anthropic signatures might be hex or base64, usually hex for HMAC-SHA256
    // The SDK helper is safer but we'll implement the logic here for clarity
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

/** Resolve Claude Webhook Secret: database → env */
async function resolveWebhookSecret(): Promise<string> {
  // Try database first
  try {
    const shop = await prisma.shop.findFirst({
      select: { claudeWebhookSecret: true },
    });
    if (shop?.claudeWebhookSecret) return shop.claudeWebhookSecret;
  } catch (e) {
    console.warn("[ZicaAI Webhook] Could not read DB secret:", e);
  }

  // Fallback to env vars
  return process.env.CLAUDE_WEBHOOK_SECRET || "";
}

/**
 * POST /api/webhooks/zica-ai
 * Receiver for Zica AI events and notifications from Claude Platform.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature") || req.headers.get("anthropic-signature") || "";
    
    const activeSecret = await resolveWebhookSecret();

    // Verify signature if secret is configured
    if (activeSecret) {
      if (!signature) {
        console.warn("[Zica AI Webhook] No signature header found");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!verifySignature(rawBody, signature, activeSecret)) {
        console.warn("[Zica AI Webhook] Invalid signature received");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // Freshness check (Replay protection)
    const createdAt = payload.created_at || payload.timestamp;
    if (createdAt) {
      const eventTime = new Date(createdAt).getTime();
      const now = Date.now();
      if (Math.abs(now - eventTime) > 5 * 60 * 1000) { // 5 minutes
        console.warn("[Zica AI Webhook] Stale event received");
        return NextResponse.json({ error: "Stale event" }, { status: 400 });
      }
    }

    const source = req.headers.get("x-webhook-source") || "claude_platform";
    const eventType = payload.type || "generic_update";

    // Log the event for AI to process or for admin to see
    const event = await prisma.webhookEvent.create({
      data: {
        source: `ZICA_AI_${source.toUpperCase()}`,
        eventType: eventType,
        payload: rawBody,
        processed: false
      }
    });

    console.log(`[Zica AI Webhook] Received ${eventType} from ${source}`);

    return NextResponse.json({ 
      success: true, 
      message: "Event received and verified",
      eventId: event.id 
    });
  } catch (error: any) {
    console.error("[Zica AI Webhook] Error:", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/zica-ai
 * List recent events for the dashboard.
 */
export async function GET() {
  try {
    const events = await prisma.webhookEvent.findMany({
      where: {
        source: {
          startsWith: "ZICA_AI"
        }
      },
      take: 50,
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
