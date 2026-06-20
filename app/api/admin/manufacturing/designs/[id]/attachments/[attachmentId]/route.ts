import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params;

    const attachment = await prisma.mfgDesignAttachment.findUnique({
      where: { id: attachmentId }
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    await prisma.mfgDesignAttachment.delete({
      where: { id: attachmentId }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgDesignAssignment", id, "DELETE_ATTACHMENT", actor, { type: attachment.type, fileName: attachment.fileName });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
