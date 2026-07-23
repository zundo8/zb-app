/**
 * GET & PATCH /api/admin/ai/settings
 * Admin API to manage shop-wide Zica AI toggles for Support & WhatsApp.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolvePrincipal } from "@/lib/ai/principal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const shop = await prisma.shop.findFirst({
      select: {
        id: true,
        zicaAiSupportEnabled: true,
        zicaAiWhatsappEnabled: true,
      },
    });

    return NextResponse.json({
      zicaAiSupportEnabled: shop?.zicaAiSupportEnabled ?? true,
      zicaAiWhatsappEnabled: shop?.zicaAiWhatsappEnabled ?? true,
    });
  } catch (error: any) {
    console.error("[AI Settings API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch AI settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const principal = await resolvePrincipal(req);
    if (principal.kind !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin required" }, { status: 403 });
    }

    const body = await req.json();
    const { zicaAiSupportEnabled, zicaAiWhatsappEnabled } = body;

    let shop = await prisma.shop.findFirst();
    if (!shop) {
      // Create a default shop record if one doesn't exist
      shop = await prisma.shop.create({
        data: {
          name: "Zica Bella",
          zicaAiSupportEnabled: true,
          zicaAiWhatsappEnabled: true,
        },
      });
    }

    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(typeof zicaAiSupportEnabled === "boolean" && { zicaAiSupportEnabled }),
        ...(typeof zicaAiWhatsappEnabled === "boolean" && { zicaAiWhatsappEnabled }),
      },
    });

    return NextResponse.json({
      success: true,
      zicaAiSupportEnabled: updated.zicaAiSupportEnabled,
      zicaAiWhatsappEnabled: updated.zicaAiWhatsappEnabled,
    });
  } catch (error: any) {
    console.error("[AI Settings API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update AI settings" }, { status: 500 });
  }
}
