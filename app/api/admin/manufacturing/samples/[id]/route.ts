import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sample = await prisma.mfgSample.findUnique({
      where: { id },
      include: {
        designAssignment: {
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true }
            },
            collection: true
          }
        },
        vendor: true,
        images: true,
        revisions: {
          orderBy: { revisionNumber: "asc" }
        }
      }
    });

    if (!sample) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }

    return NextResponse.json(sample);
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
    
    // Authenticated session is required to retrieve the reviewer's ID
    const session = await requireAuth();
    const currentUserId = (session.user as any).id;
    const actor = await getManufacturingActorName();

    const body = await req.json();
    const { action, adminComments, changeRequests } = body;

    const sample = await prisma.mfgSample.findUnique({
      where: { id },
      include: {
        designAssignment: true,
        images: true
      }
    });

    if (!sample) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }

    const designerId = sample.designAssignment.assignedToId;

    if (action === "APPROVE") {
      const updatedSample = await prisma.$transaction(async (tx) => {
        // 1. Update Sample
        const s = await tx.mfgSample.update({
          where: { id },
          data: {
            status: "Approved",
            reviewedAt: new Date(),
            reviewedById: currentUserId,
            adminComments: adminComments || null
          },
          include: {
            designAssignment: true,
            vendor: true,
            images: true,
            revisions: true
          }
        });

        // 2. Update parent design assignment status to "Approved"
        await tx.mfgDesignAssignment.update({
          where: { id: sample.designAssignmentId },
          data: { status: "Approved" }
        });

        // 3. Upsert into Product Knowledge Base
        await tx.mfgProductKnowledgeBase.upsert({
          where: { styleCode: sample.styleCode },
          create: {
            styleCode: sample.styleCode,
            productName: sample.productName,
            designerId: designerId,
            fabricUsed: sample.fabricType,
            gsm: sample.gsm,
            composition: sample.composition,
            printingTechnique: sample.printingTechnique,
            vendorId: sample.vendorId,
            accessoriesUsed: sample.accessoriesUsed,
            sampleImages: sample.images.map((img) => img.imageUrl),
            approvalDate: new Date()
          },
          update: {
            productName: sample.productName,
            designerId: designerId,
            fabricUsed: sample.fabricType,
            gsm: sample.gsm,
            composition: sample.composition,
            printingTechnique: sample.printingTechnique,
            vendorId: sample.vendorId,
            accessoriesUsed: sample.accessoriesUsed,
            sampleImages: sample.images.map((img) => img.imageUrl),
            approvalDate: new Date()
          }
        });

        // 4. Create Employee Performance entry for designer
        if (designerId) {
          await tx.mfgEmployeePerformance.create({
            data: {
              userId: designerId,
              eventType: "Sample Approved",
              scoreDelta: 5.0,
              referenceId: id,
              referenceType: "MfgSample",
              notes: `Sample approved for style ${sample.styleCode}.`
            }
          });
        }

        return s;
      });

      await logMfgAudit("MfgSample", id, "APPROVED", actor, { styleCode: sample.styleCode });
      return NextResponse.json(updatedSample);

    } else if (action === "REJECT") {
      const updatedSample = await prisma.$transaction(async (tx) => {
        const s = await tx.mfgSample.update({
          where: { id },
          data: {
            status: "Rejected",
            reviewedAt: new Date(),
            reviewedById: currentUserId,
            adminComments: adminComments || null
          },
          include: {
            designAssignment: true,
            vendor: true,
            images: true,
            revisions: true
          }
        });

        await tx.mfgDesignAssignment.update({
          where: { id: sample.designAssignmentId },
          data: { status: "Rejected" }
        });

        if (designerId) {
          await tx.mfgEmployeePerformance.create({
            data: {
              userId: designerId,
              eventType: "Sample Rejected",
              scoreDelta: -3.0,
              referenceId: id,
              referenceType: "MfgSample",
              notes: `Sample rejected for style ${sample.styleCode}.`
            }
          });
        }

        return s;
      });

      await logMfgAudit("MfgSample", id, "REJECTED", actor, { styleCode: sample.styleCode });
      return NextResponse.json(updatedSample);

    } else if (action === "REQUEST_REVISION") {
      if (!changeRequests) {
        return NextResponse.json({ error: "Change requests description is required for revisions" }, { status: 400 });
      }

      const updatedSample = await prisma.$transaction(async (tx) => {
        const s = await tx.mfgSample.update({
          where: { id },
          data: {
            status: "Revision Required",
            reviewedAt: new Date(),
            reviewedById: currentUserId,
            adminComments: adminComments || null
          },
          include: {
            designAssignment: true,
            vendor: true,
            images: true,
            revisions: true
          }
        });

        await tx.mfgDesignAssignment.update({
          where: { id: sample.designAssignmentId },
          data: { status: "Revision Required" }
        });

        // Count existing revisions
        const revisionCount = await tx.mfgSampleRevision.count({
          where: { sampleId: id }
        });

        await tx.mfgSampleRevision.create({
          data: {
            sampleId: id,
            revisionNumber: revisionCount + 1,
            changeRequests: changeRequests
          }
        });

        if (designerId) {
          await tx.mfgEmployeePerformance.create({
            data: {
              userId: designerId,
              eventType: "Revision Requested",
              scoreDelta: -2.0,
              referenceId: id,
              referenceType: "MfgSample",
              notes: `Revision requested on sample ${sample.styleCode}.`
            }
          });
        }

        return s;
      });

      await logMfgAudit("MfgSample", id, "REVISION_REQUESTED", actor, { styleCode: sample.styleCode, changeRequests });
      return NextResponse.json(updatedSample);
    } else {
      // Just standard patch for fields if action not specified (e.g. updating adminComments only)
      const data: any = {};
      if (adminComments !== undefined) data.adminComments = adminComments;

      const updatedSample = await prisma.mfgSample.update({
        where: { id },
        data,
        include: {
          designAssignment: true,
          vendor: true,
          images: true,
          revisions: true
        }
      });

      await logMfgAudit("MfgSample", id, "UPDATE_COMMENTS", actor, data);
      return NextResponse.json(updatedSample);
    }
  } catch (e: any) {
    if (e.message === "401" || e.message === "403") {
      return handleAuthError(e);
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
