/**
 * POST /api/app/payment-error — Claude-powered payment error translation
 * 
 * Translates Razorpay error codes into friendly, actionable messages.
 * Public endpoint (for RN app) — does not expose any secrets.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { error_code, error_description, payment_method } = body;

    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback without Claude
      return NextResponse.json({
        message: getStaticErrorMessage(error_code, error_description),
      });
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        system: "You are a payment assistant for Zica Bella, a premium Indian streetwear brand. Translate this Razorpay payment error into a short, friendly, actionable message for a fashion app customer. Keep it under 2 sentences. Be warm and reassuring. Return only the message text, nothing else.",
        messages: [
          {
            role: "user",
            content: `Error code: ${error_code}\nError description: ${error_description}\nPayment method: ${payment_method}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!response.ok) {
      return NextResponse.json({
        message: getStaticErrorMessage(error_code, error_description),
      });
    }

    const data = await response.json();
    const message = data.content?.[0]?.text || getStaticErrorMessage(error_code, error_description);

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({
      message: "Something went wrong with your payment. Please try again or use a different payment method.",
    });
  }
}

function getStaticErrorMessage(code: string, description: string): string {
  const codeMap: Record<string, string> = {
    BAD_REQUEST_ERROR: "There was an issue with your payment details. Please check and try again.",
    GATEWAY_ERROR: "The payment gateway is temporarily unavailable. Please try again in a moment.",
    SERVER_ERROR: "We're experiencing technical difficulties. Please try again shortly.",
    NETWORK_ERROR: "Please check your internet connection and try again.",
  };
  return codeMap[code] || description || "Payment could not be processed. Please try again or use a different method.";
}
