import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attachments = await prisma.mfgDesignAttachment.findMany({
      where: { assignmentId: id },
      orderBy: { uploadedAt: "desc" }
    });
    return NextResponse.json(attachments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, fileUrl, fileName } = body;

    if (!type || !fileUrl) {
      return NextResponse.json({ error: "Type and file URL are required" }, { status: 400 });
    }

    const attachment = await prisma.mfgDesignAttachment.create({
      data: {
        assignmentId: id,
        type,
        fileUrl,
        fileName: fileName || null
      }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgDesignAssignment", id, "ADD_ATTACHMENT", actor, { type, fileName });

    return NextResponse.json(attachment);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
