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
    const revisions = await prisma.mfgSampleRevision.findMany({
      where: { sampleId: id },
      orderBy: { revisionNumber: "asc" }
    });
    return NextResponse.json(revisions);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sampleId } = await params;
    const body = await req.json();
    const { revisionId, designerResponse, resubmissionDate } = body;

    if (!revisionId) {
      return NextResponse.json({ error: "Revision ID is required" }, { status: 400 });
    }

    const actor = await getManufacturingActorName();

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update the revision details
      const updateData: any = {};
      if (designerResponse !== undefined) updateData.designerResponse = designerResponse;
      if (resubmissionDate !== undefined) {
        updateData.resubmissionDate = resubmissionDate ? new Date(resubmissionDate) : null;
      }

      const rev = await tx.mfgSampleRevision.update({
        where: { id: revisionId },
        data: updateData
      });

      // 2. If designer response is provided, reset parent statuses to pending review / submitted
      if (designerResponse) {
        // Update sample status
        await tx.mfgSample.update({
          where: { id: sampleId },
          data: { status: "Pending Review" }
        });

        // Get sample details to find designAssignmentId
        const sample = await tx.mfgSample.findUnique({
          where: { id: sampleId },
          select: { designAssignmentId: true }
        });

        if (sample?.designAssignmentId) {
          // Update design assignment status to Submitted
          await tx.mfgDesignAssignment.update({
            where: { id: sample.designAssignmentId },
            data: { status: "Submitted" }
          });
        }
      }

      return rev;
    });

    await logMfgAudit("MfgSample", sampleId, "SUBMIT_REVISION_RESPONSE", actor, { revisionId });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
