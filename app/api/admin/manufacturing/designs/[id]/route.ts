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
    const design = await prisma.mfgDesignAssignment.findUnique({
      where: { id },
      include: {
        collection: true,
        assignedTo: {
          select: { id: true, name: true, email: true, role: true }
        },
        assignedBy: {
          select: { id: true, name: true, email: true, role: true }
        },
        attachments: true,
        samples: {
          include: {
            vendor: true,
            images: true,
            revisions: {
              orderBy: { revisionNumber: "asc" }
            }
          }
        }
      }
    });

    if (!design) {
      return NextResponse.json({ error: "Design assignment not found" }, { status: 404 });
    }

    const auditLogs = await prisma.mfgAuditLog.findMany({
      where: {
        OR: [
          { entityId: id },
          { entityId: { in: design.samples.map((s: any) => s.id) } }
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      ...design,
      auditLogs
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, priority, notes, submissionDeadline } = body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (notes !== undefined) data.notes = notes;
    if (submissionDeadline !== undefined) {
      data.submissionDeadline = submissionDeadline ? new Date(submissionDeadline) : null;
    }

    const design = await prisma.mfgDesignAssignment.update({
      where: { id },
      data,
      include: {
        collection: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgDesignAssignment", id, "UPDATE", actor, data);

    return NextResponse.json(design);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const actor = await getManufacturingActorName();

    await prisma.$transaction(async (tx: any) => {
      // 1. Delete design attachments
      await tx.mfgDesignAttachment.deleteMany({
        where: { assignmentId: id }
      });

      // 2. Delete samples (and cascade to images & revisions)
      const samples = await tx.mfgSample.findMany({
        where: { designAssignmentId: id }
      });

      for (const s of samples) {
        await tx.mfgSample.delete({
          where: { id: s.id }
        });
      }

      // 3. Delete design assignment
      await tx.mfgDesignAssignment.delete({
        where: { id }
      });
    });

    await logMfgAudit("MfgDesignAssignment", id, "DELETE", actor, {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
