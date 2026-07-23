/**
 * GET & PATCH /api/whatsapp/chat/settings
 * Manage per-conversation WhatsApp settings (e.g. AI auto-reply toggle).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { formatPhone } from "@/lib/whatsapp/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "Missing phone parameter" }, { status: 400 });
    }

    const clean10 = phone.replace(/\D/g, "").slice(-10);

    const setting = await prisma.whatsAppChatSetting.findFirst({
      where: {
        phoneNumber: { contains: clean10 },
      },
    });

    return NextResponse.json({
      phoneNumber: phone,
      aiAutoReply: setting ? setting.aiAutoReply : true,
    });
  } catch (error: any) {
    console.error("[WhatsApp Chat Settings API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch chat settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, aiAutoReply } = body;

    if (!phone || typeof aiAutoReply !== "boolean") {
      return NextResponse.json({ error: "phone and aiAutoReply (boolean) are required" }, { status: 400 });
    }

    const formattedPhone = formatPhone(phone) || phone;
    const clean10 = phone.replace(/\D/g, "").slice(-10);

    const existing = await prisma.whatsAppChatSetting.findFirst({
      where: {
        phoneNumber: { contains: clean10 },
      },
    });

    let updated;
    if (existing) {
      updated = await prisma.whatsAppChatSetting.update({
        where: { id: existing.id },
        data: { aiAutoReply },
      });
    } else {
      updated = await prisma.whatsAppChatSetting.create({
        data: {
          phoneNumber: formattedPhone,
          aiAutoReply,
        },
      });
    }

    return NextResponse.json({
      success: true,
      phoneNumber: formattedPhone,
      aiAutoReply: updated.aiAutoReply,
    });
  } catch (error: any) {
    console.error("[WhatsApp Chat Settings API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update chat settings" }, { status: 500 });
  }
}
