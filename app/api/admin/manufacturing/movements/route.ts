import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";
import { executeFabricMovement } from "@/lib/manufacturing/execute-fabric-movement";
import type { QtyUnit } from "@/lib/manufacturing/fabric-movement-math";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fabricId = searchParams.get("fabricId") || undefined;
    const type = searchParams.get("type") || undefined;
    const q = searchParams.get("q")?.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter =
      from || to
        ? {
            occurredAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const movements = await prisma.mfgFabricMovement.findMany({
      where: {
        ...(fabricId ? { fabricId } : {}),
        ...(type && ["IN", "OUT", "ADJUSTMENT"].includes(type) ? { type } : {}),
        ...dateFilter,
        ...(q
          ? {
              fabric: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { sku: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      include: { fabric: true },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(movements);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fabricId,
      type,
      quantity,
      quantityUnit,
      rateAtMovement,
      occurredAt,
      remarks,
      productionBatchId,
      correctsMovementId,
    } = body;

    if (!fabricId || !type || quantity === undefined || !quantityUnit) {
      return NextResponse.json(
        { error: "fabricId, type, quantity, and quantityUnit are required" },
        { status: 400 }
      );
    }

    if (!["IN", "OUT", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const unit = quantityUnit as QtyUnit;
    if (!["m", "kg", "g"].includes(unit)) {
      return NextResponse.json({ error: "quantityUnit must be m, kg, or g" }, { status: 400 });
    }

    const qty = Number(quantity);
    if (Number.isNaN(qty)) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    if (type !== "ADJUSTMENT" && qty <= 0) {
      return NextResponse.json({ error: "Quantity must be positive for IN/OUT" }, { status: 400 });
    }

    const rate = Number(rateAtMovement);
    if (Number.isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
    }

    const actor = await getManufacturingActorName();
    const when = occurredAt ? new Date(occurredAt) : new Date();

    if (productionBatchId) {
      const b = await prisma.mfgProductionBatch.findUnique({
        where: { id: productionBatchId },
      });
      if (!b) {
        return NextResponse.json({ error: "Production batch not found" }, { status: 400 });
      }
    }

    if (correctsMovementId) {
      const orig = await prisma.mfgFabricMovement.findUnique({
        where: { id: correctsMovementId },
      });
      if (!orig || orig.fabricId !== fabricId) {
        return NextResponse.json({ error: "Invalid correction reference" }, { status: 400 });
      }
    }

    const { row, totalValue } = await prisma.$transaction(async (tx: any) => {
      return executeFabricMovement(tx, {
        fabricId,
        type,
        quantity: qty,
        quantityUnit: unit,
        rateAtMovement: rate,
        occurredAt: when,
        remarks: typeof remarks === "string" ? remarks : null,
        productionBatchId: productionBatchId || null,
        correctsMovementId: correctsMovementId || null,
        actor,
      });
    });

    await logMfgAudit("MfgFabricMovement", row.id, "CREATE", actor, {
      fabricId,
      type,
      quantity: qty,
      unit,
      totalValue,
    });

    return NextResponse.json({ success: true, movement: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
