import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { 
      name, 
      address, 
      mobile, 
      category,
      contactPerson,
      email,
      pricingNotes,
      leadTimeDays,
      remarks
    } = body;

    const vendor = await prisma.mfgVendor.update({
      where: { id },
      data: { 
        name, 
        address, 
        mobile, 
        category,
        contactPerson: contactPerson || null,
        email: email || null,
        pricingNotes: pricingNotes || null,
        leadTimeDays: leadTimeDays ? parseInt(String(leadTimeDays), 10) : null,
        remarks: remarks || null
      },
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgVendor", id, "UPDATE", actor, { name, category });

    return NextResponse.json(vendor);
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
    await prisma.mfgVendor.delete({ where: { id } });

    const actor = await getManufacturingActorName();
    await logMfgAudit("MfgVendor", id, "DELETE", actor, {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
