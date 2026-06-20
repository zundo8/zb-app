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
    const images = await prisma.mfgSampleImage.findMany({
      where: { sampleId: id },
      orderBy: { uploadedAt: "desc" }
    });
    return NextResponse.json(images);
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
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    const image = await prisma.mfgSampleImage.create({
      data: {
        sampleId: id,
        imageUrl
      }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgSample", id, "ADD_IMAGE", actor, { imageUrl });

    return NextResponse.json(image);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
