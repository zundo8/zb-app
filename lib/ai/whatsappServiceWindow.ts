/**
 * lib/ai/whatsappServiceWindow.ts
 * Helper functions for verifying Meta 24-hour customer service window status.
 */

import prisma from "@/lib/db";

/**
 * Checks if the Meta 24-hour service window is active for a phone number.
 * Under Meta rules, free-form text messages can only be sent within 24 hours
 * of receiving an inbound message from the customer.
 */
export async function isWhatsAppServiceWindowActive(phoneNumber: string): Promise<boolean> {
  if (!phoneNumber) return false;

  try {
    const cleanDigits = phoneNumber.replace(/\D/g, '').slice(-10);
    if (!cleanDigits || cleanDigits.length < 10) return false;

    const lastInbound = await prisma.whatsAppMessage.findFirst({
      where: {
        phoneNumber: { contains: cleanDigits },
        direction: "inbound",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!lastInbound) return false;

    const windowMs = 24 * 60 * 60 * 1000;
    const diff = Date.now() - new Date(lastInbound.createdAt).getTime();

    return diff <= windowMs;
  } catch (err) {
    console.error("[WhatsAppServiceWindow] Error checking service window:", err);
    return false;
  }
}
