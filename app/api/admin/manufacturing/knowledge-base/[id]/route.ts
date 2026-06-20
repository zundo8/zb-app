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
    const entry = await prisma.mfgProductKnowledgeBase.findUnique({
      where: { id },
      include: {
        designer: {
          select: { id: true, name: true, email: true }
        },
        vendor: {
          select: { id: true, name: true, category: true }
        }
      }
    });

    if (!entry) {
      return NextResponse.json({ error: "Knowledge base entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
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
    
    // Allow updating fields such as designerId, fabricUsed, gsm, composition, printingTechnique, vendorId, accessoriesUsed, sampleImages, productionNotes, etc.
    const { 
      productName,
      designerId, 
      fabricUsed, 
      gsm, 
      composition, 
      printingTechnique, 
      vendorId, 
      accessoriesUsed, 
      sampleImages, 
      productionNotes 
    } = body;

    const data: any = {};
    if (productName !== undefined) data.productName = productName;
    if (designerId !== undefined) data.designerId = designerId || null;
    if (fabricUsed !== undefined) data.fabricUsed = fabricUsed || null;
    if (gsm !== undefined) data.gsm = gsm || null;
    if (composition !== undefined) data.composition = composition || null;
    if (printingTechnique !== undefined) data.printingTechnique = printingTechnique || null;
    if (vendorId !== undefined) data.vendorId = vendorId || null;
    if (accessoriesUsed !== undefined) data.accessoriesUsed = accessoriesUsed || null;
    if (sampleImages !== undefined) data.sampleImages = sampleImages;
    if (productionNotes !== undefined) data.productionNotes = productionNotes || null;

    const entry = await prisma.mfgProductKnowledgeBase.update({
      where: { id },
      data,
      include: {
        designer: {
          select: { id: true, name: true, email: true }
        },
        vendor: {
          select: { id: true, name: true, category: true }
        }
      }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgProductKnowledgeBase", id, "UPDATE", actor, data);

    return NextResponse.json(entry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
