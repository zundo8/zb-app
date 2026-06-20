import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const collections = await prisma.mfgCollection.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(collections);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, season, status } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const collection = await prisma.mfgCollection.create({
      data: {
        name,
        season: season || null,
        status: status || "ACTIVE",
      },
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgCollection", collection.id, "CREATE", actor, { name, season });

    return NextResponse.json(collection);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
