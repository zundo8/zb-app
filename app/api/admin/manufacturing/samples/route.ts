import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const designAssignmentId = searchParams.get("designAssignmentId") || undefined;

    const where: any = {};
    if (status && status !== "All") where.status = status;
    if (designAssignmentId) where.designAssignmentId = designAssignmentId;

    const samples = await prisma.mfgSample.findMany({
      where,
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
      },
      orderBy: { submittedAt: "desc" }
    });

    return NextResponse.json(samples);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      designAssignmentId,
      styleCode,
      productName,
      fabricType,
      gsm,
      composition,
      printingTechnique,
      embroideryDetails,
      accessoriesUsed,
      vendorId,
      remarks
    } = body;

    if (!designAssignmentId || !styleCode || !productName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sample = await prisma.$transaction(async (tx: any) => {
      // 1. Create the sample
      const newSample = await tx.mfgSample.create({
        data: {
          designAssignmentId,
          styleCode,
          productName,
          fabricType: fabricType || null,
          gsm: gsm || null,
          composition: composition || null,
          printingTechnique: printingTechnique || null,
          embroideryDetails: embroideryDetails || null,
          accessoriesUsed: accessoriesUsed || null,
          vendorId: vendorId || null,
          remarks: remarks || null,
          status: "Pending Review"
        }
      });

      // 2. Update the parent design assignment status to "Submitted"
      await tx.mfgDesignAssignment.update({
        where: { id: designAssignmentId },
        data: { status: "Submitted" }
      });

      return newSample;
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgSample", sample.id, "SUBMITTED", actor, { styleCode, productName });

    return NextResponse.json(sample);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
