/**
 * lib/ai/supportAgent.ts
 * AI auto-reply handler for customer support tickets.
 *
 * Rules:
 * - Generates auto-reply using Claude with customer-allowed tools
 * - Evaluates human handoff conditions
 * - Inserts AI messages with senderType: 'ZICA_AI'
 * - Resolves customer identity from ticket data (customerId, guestEmail)
 * - Supports multi-round tool-use loops for chained lookups
 */

import prisma from "@/lib/db";
import { callClaude, MAX_TOOL_LOOPS } from "./claudeClient";
import { filterToolsForPrincipal } from "./toolAllowList";
import { getCustomerPrompt } from "./prompts";
import { applyOutputGuard } from "./outputGuard";
import { executeClaudeTool } from "@/lib/services/claudeToolExecutor";
import { ZICA_TOOLS } from "@/lib/services/claudeService";
import type { Principal } from "./principal";
import Anthropic from "@anthropic-ai/sdk";

export interface SupportReplyResult {
  replied: boolean;
  message?: string;
  handoffTriggered?: boolean;
  handoffReason?: string;
}

// ---------------------------------------------------------------------------
// Handoff check
// ---------------------------------------------------------------------------

function checkHandoffTriggers(ticket: any, messages: any[], newContent: string): { trigger: boolean; reason?: string } {
  // 1. Customer explicitly requests human agent
  const humanKeywords = ["human", "agent", "person", "representative", "manager", "support executive", "real person", "talk to human", "speak to human"];
  const lowerContent = newContent.toLowerCase();
  if (humanKeywords.some(kw => lowerContent.includes(kw))) {
    return { trigger: true, reason: "Customer requested human assistance" };
  }

  // 2. Payment dispute / refund / chargeback keywords
  const disputeKeywords = ["dispute", "chargeback", "legal", "consumer court", "fraud", "police", "scam", "cheat"];
  if (disputeKeywords.some(kw => lowerContent.includes(kw))) {
    return { trigger: true, reason: "Dispute or legal complaint detected" };
  }

  // 3. More than 8 AI messages without a human AGENT response
  const aiMessageCount = messages.filter(m => m.senderType === "ZICA_AI").length;
  const humanAgentCount = messages.filter(m => m.senderType === "AGENT").length;
  if (aiMessageCount >= 8 && humanAgentCount === 0) {
    return { trigger: true, reason: "Maximum AI auto-replies reached without human resolution" };
  }

  return { trigger: false };
}

// ---------------------------------------------------------------------------
// Resolve customer principal from ticket data
// ---------------------------------------------------------------------------

async function resolveTicketPrincipal(ticket: any): Promise<Principal> {
  // 1. If ticket has customerId with customer relation loaded
  if (ticket.customerId) {
    const customer = ticket.customer;
    return {
      kind: "customer",
      customerId: ticket.customerId,
      email: customer?.email || undefined,
      phone: customer?.phone || undefined,
    };
  }

  // 2. If ticket has guestEmail, try to find matching customer in DB
  if (ticket.guestEmail) {
    try {
      const customer = await prisma.customer.findFirst({
        where: { email: ticket.guestEmail },
        select: { id: true, email: true, phone: true },
      });
      if (customer) {
        // Link the customer to the ticket for future lookups
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { customerId: customer.id },
        }).catch(() => {}); // Non-critical, best-effort

        return {
          kind: "customer",
          customerId: customer.id,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
        };
      }
    } catch (err) {
      console.error("[SupportAgent] Error resolving guest email to customer:", err);
    }
  }

  return { kind: "guest" };
}

// ---------------------------------------------------------------------------
// Generate AI Reply
// ---------------------------------------------------------------------------

export async function processSupportTicketAIReply(ticketId: string, latestUserMessage: string): Promise<SupportReplyResult> {
  try {
    // 1. Check global env kill switch & shop settings
    if (process.env.DISABLE_SUPPORT_AI === "true") {
      return { replied: false, handoffReason: "Support AI disabled via env" };
    }

    const shop = await prisma.shop.findFirst({
      select: { zicaAiSupportEnabled: true },
    });
    if (shop && shop.zicaAiSupportEnabled === false) {
      return { replied: false, handoffReason: "Support AI disabled in Shop settings" };
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20,
        },
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (!ticket || ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
      return { replied: false };
    }

    // 2. Check per-ticket AI auto-reply toggle
    if (ticket.aiAutoReply === false) {
      return { replied: false, handoffReason: "AI auto-reply turned off by admin for this ticket" };
    }

    // Check handoff triggers
    const handoff = checkHandoffTriggers(ticket, ticket.messages, latestUserMessage);
    if (handoff.trigger) {
      // Mark ticket status for human review if needed
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { priority: "HIGH" },
      });
      return { replied: false, handoffTriggered: true, handoffReason: handoff.reason };
    }

    // 3. Resolve principal from ticket data (customer relation or guest email lookup)
    const principal = await resolveTicketPrincipal(ticket);

    const allowedTools = filterToolsForPrincipal(ZICA_TOOLS as any, principal);

    // Build enriched system prompt with customer context
    let customerContext = '';
    if (principal.kind === 'customer') {
      const customerName = (ticket as any).customer?.name || ticket.guestName || 'Customer';
      const customerEmail = (ticket as any).customer?.email || ticket.guestEmail || '';
      customerContext = `\n\nCustomer Context: The customer's name is "${customerName}"${customerEmail ? ` and email is "${customerEmail}"` : ''}. You are assisting this specific customer with their support ticket.`;
    }

    const systemPrompt = getCustomerPrompt()
      + `\n\nSupport Ticket Subject: "${ticket.subject}". Help the user resolve their query cleanly and politely.`
      + customerContext
      + `\n\nIMPORTANT: When a customer provides an order number (like ZB-XXXX-XXXXX or #1234), use the get_order_by_number tool to look it up. Do NOT say you cannot find it without trying the tool first.`;

    const conversationHistory: Anthropic.MessageParam[] = ticket.messages.map((m: any) => ({
      role: m.senderType === "USER" ? "user" : "assistant",
      content: m.content,
    }));

    // Multi-round tool-use loop (up to 3 rounds for chained lookups)
    const maxToolRounds = Math.min(3, MAX_TOOL_LOOPS);
    let currentMessages = [...conversationHistory];
    let finalAnswer = "";

    for (let round = 0; round < maxToolRounds; round++) {
      const result = await callClaude({
        systemPrompt,
        messages: currentMessages,
        tools: allowedTools as Anthropic.Tool[],
      });

      const response = result.response;

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

        currentMessages.push({ role: "assistant", content: response.content as any });
        currentMessages.push({ role: "user", content: toolResults });
        // Continue the loop to let Claude process tool results
        continue;
      }

      // Claude returned a text response — extract it
      finalAnswer = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
        .join("\n");
      break;
    }

    // If all rounds were tool_use and we never got a text response, do one final call
    if (!finalAnswer) {
      const finalResult = await callClaude({
        systemPrompt,
        messages: currentMessages,
        tools: allowedTools as Anthropic.Tool[],
      });
      finalAnswer = finalResult.response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as any).text)
        .join("\n");
    }

    // Apply Output Guard
    const safeText = applyOutputGuard(finalAnswer, "support");

    // Save AI reply to database
    await prisma.supportMessage.create({
      data: {
        ticketId,
        content: safeText,
        senderType: "ZICA_AI",
        senderId: "system",
        senderName: "Zica AI",
      },
    });

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return { replied: true, message: safeText };
  } catch (error: any) {
    console.error("[SupportAgent] Auto-reply error:", error);
    return { replied: false };
  }
}
