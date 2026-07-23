/**
 * POST /api/app/payment-error — Claude-powered payment error translation
 * 
 * Translates Razorpay error codes into friendly, actionable messages.
 * Public endpoint (for RN app) — does not expose any secrets.
 */

import { NextResponse } from "next/server";
import { callClaude } from "@/lib/ai/claudeClient";
import { getFastModel } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { error_code, error_description, payment_method } = body;

    try {
      const fastModel = getFastModel();
      const result = await callClaude({
        systemPrompt: "You are a payment assistant for Zica Bella, a premium Indian streetwear brand. Translate this Razorpay payment error into a short, friendly, actionable message for a fashion app customer. Keep it under 2 sentences. Be warm and reassuring. Return only the message text, nothing else.",
        messages: [
          {
            role: "user",
            content: `Error code: ${error_code}\nError description: ${error_description}\nPayment method: ${payment_method}`,
          },
        ],
        maxTokens: 150,
        modelChain: [fastModel],
        signal: AbortSignal.timeout(5000),
      });

      const message = result.response.content[0]?.type === "text"
        ? result.response.content[0].text
        : getStaticErrorMessage(error_code, error_description);

      return NextResponse.json({ message });
    } catch (apiErr) {
      return NextResponse.json({
        message: getStaticErrorMessage(error_code, error_description),
      });
    }
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
