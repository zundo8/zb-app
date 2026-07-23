/**
 * lib/ai/whatsappAgent.ts
 * AI auto-reply handler for incoming WhatsApp messages.
 *
 * Rules:
 * - Identifies customer by phone number ONLY (last-10 digits via formatPhone)
 * - Checks opt-out status (WhatsAppOptIn / Customer.whatsappOptedOut)
 * - Checks 24-hour service window
 * - Calls Claude with customer or guest prompt + customer tool allow-list
 * - Applies Output Guard before sending reply via WhatsApp API
 */

import prisma from "@/lib/db";
import { formatPhone } from "@/lib/whatsapp/client";
import { WhatsAppService } from "@/lib/services/whatsapp.service";
import { isWhatsAppServiceWindowActive } from "./whatsappServiceWindow";
import { callClaude } from "./claudeClient";
import { filterToolsForPrincipal } from "./toolAllowList";
import { getPromptForPrincipal } from "./prompts";
import { applyOutputGuard } from "./outputGuard";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import { ZICA_TOOLS } from "@/lib/services/claudeService";
import type { Principal } from "./principal";
import Anthropic from "@anthropic-ai/sdk";

export interface WhatsAppAIReplyResult {
  replied: boolean;
  message?: string;
  reason?: string;
}

export async function processWhatsAppAIReply(
  rawPhone: string,
  userMessageText: string
): Promise<WhatsAppAIReplyResult> {
  try {
    // 1. Check feature flag / kill switch & shop settings
    if (process.env.DISABLE_WHATSAPP_AI === "true") {
      return { replied: false, reason: "WhatsApp AI disabled via environment" };
    }

    const shop = await prisma.shop.findFirst({
      select: { zicaAiWhatsappEnabled: true },
    });
    if (shop && shop.zicaAiWhatsappEnabled === false) {
      return { replied: false, reason: "WhatsApp AI disabled in Shop settings" };
    }

    const phoneNumber = formatPhone(rawPhone) || rawPhone;
    const clean10Digits = rawPhone.replace(/\D/g, '').slice(-10);

    // Check per-chat AI auto-reply toggle
    const chatSetting = await prisma.whatsAppChatSetting.findFirst({
      where: {
        phoneNumber: { contains: clean10Digits },
      },
    });
    if (chatSetting && chatSetting.aiAutoReply === false) {
      return { replied: false, reason: "AI auto-reply turned off by admin for this conversation" };
    }

    // 2. Check Opt-Out status
    const optInRecord = await prisma.whatsAppOptIn.findFirst({
      where: { phone: { contains: clean10Digits } },
    });
    if (optInRecord?.status === "opted_out") {
      return { replied: false, reason: "Customer has opted out of WhatsApp" };
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: { contains: clean10Digits } },
    });
    if (customer?.whatsappOptedOut) {
      return { replied: false, reason: "Customer profile marked as opted out" };
    }

    // 3. Verify 24-hour service window (always active if inbound user text is present)
    const windowActive = (userMessageText && userMessageText.trim().length > 0) ? true : await isWhatsAppServiceWindowActive(phoneNumber);
    if (!windowActive) {
      return { replied: false, reason: "Meta 24-hour service window expired" };
    }

    // 4. Derive principal (customer or guest) by phone lookup only
    const principal: Principal = customer
      ? { kind: "customer", customerId: customer.id, phone: customer.phone || undefined, email: customer.email || undefined }
      : { kind: "guest" };

    // 5. Fetch recent chat history (last 10 messages)
    const recentMessages = await prisma.whatsAppMessage.findMany({
      where: { phoneNumber: { contains: clean10Digits } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    recentMessages.reverse();

    const conversationHistory: Anthropic.MessageParam[] = recentMessages.map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: m.body || "",
    }));

    // Add current incoming message if not already in history
    if (!recentMessages.some((m: any) => m.body === userMessageText)) {
      conversationHistory.push({ role: "user", content: userMessageText });
    }

    const allowedTools = filterToolsForPrincipal(ZICA_TOOLS as any, principal);
    const systemPrompt = getPromptForPrincipal(principal.kind) + `\n\nChannel: WhatsApp. Keep responses concise (under 250 characters when possible). Format key details cleanly. Prefix your initial response with "Zica AI: "`;

    const result = await callClaude({
      systemPrompt,
      messages: conversationHistory,
      tools: allowedTools as Anthropic.Tool[],
    });

    const response = result.response;
    let finalAnswer = "";

    if (response.stop_reason === "tool_use") {
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use" && block.name && block.id) {
          const toolOutput = await executeClaudeTool(block.name, block.input || {}, principal);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: toolOutput,
          });
        }
      }

      conversationHistory.push({ role: "assistant", content: response.content as any });
      conversationHistory.push({ role: "user", content: toolResults });

      const secondCall = await callClaude({
        systemPrompt,
        messages: conversationHistory,
        tools: allowedTools as Anthropic.Tool[],
      });

      finalAnswer = secondCall.response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
        .join("\n");
    } else {
      finalAnswer = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
        .join("\n");
    }

    // Apply Output Guard
    const safeText = applyOutputGuard(finalAnswer, "whatsapp");

    // Send reply via WhatsApp Production Service
    const sent = await WhatsAppService.sendTextMessage(phoneNumber, safeText);

    if (sent) {
      // Record outbound AI message in database
      await prisma.whatsAppMessage.create({
        data: {
          direction: "outbound",
          phoneNumber,
          userId: customer?.id || null,
          body: safeText,
          status: "sent",
        },
      });
    }

    return { replied: true, message: safeText };
  } catch (error: any) {
    console.error("[WhatsAppAgent] Auto-reply error:", error);
    return { replied: false, reason: "Internal error processing WhatsApp AI reply" };
  }
}
