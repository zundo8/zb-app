import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { suggestBatchCode } from "@/lib/manufacturing/sku";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";
import { executeFabricMovement } from "@/lib/manufacturing/execute-fabric-movement";

export const dynamic = "force-dynamic";

const ALLOWED_STAGES = new Set([
  "READY_FOR_PRODUCTION",
  "IN_PRODUCTION_CUTTING",
  "SENT_PRINTING",
  "SENT_EMBROIDERY",
  "SENT_WASH",
  "RETURNED_COMBINED",
  "SENT_SAMPLE",
  "QC_PASSED",
  "REJECTED_REWORK",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage") || undefined;
    const q = searchParams.get("q")?.trim();

    const batches = await prisma.mfgProductionBatch.findMany({
      where: {
        ...(stage ? { currentStage: stage } : {}),
        ...(q
          ? {
              OR: [
                { batchCode: { contains: q, mode: "insensitive" } },
                { productName: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        fabric: { select: { id: true, sku: true, name: true, costPerMeter: true } },
        stageLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const ids = batches.map((b: any) => b.id);
    const fabBy = new Map<string, number>();
    const stageBy = new Map<string, number>();
    const miscBy = new Map<string, number>();

    if (ids.length > 0) {
      const [fabG, stageG, miscG] = await Promise.all([
        prisma.mfgFabricMovement.groupBy({
          by: ["productionBatchId"],
          where: { productionBatchId: { in: ids }, type: "OUT" },
          _sum: { totalValue: true },
        }),
        prisma.mfgProductionStageLog.groupBy({
          by: ["batchId"],
          where: { batchId: { in: ids } },
          _sum: { costAmount: true },
        }),
        prisma.mfgMiscExpense.groupBy({
          by: ["batchId"],
          where: { batchId: { in: ids } },
          _sum: { amount: true },
        }),
      ]);

      for (const r of fabG) {
        if (r.productionBatchId)
          fabBy.set(r.productionBatchId, r._sum.totalValue || 0);
      }
      for (const r of stageG) {
        stageBy.set(r.batchId, r._sum.costAmount || 0);
      }
      for (const r of miscG) {
        if (r.batchId) miscBy.set(r.batchId, r._sum.amount || 0);
      }
    }

    const enriched = batches.map((b: any) => {
      const totalCostSoFar =
        (fabBy.get(b.id) || 0) + (stageBy.get(b.id) || 0) + (miscBy.get(b.id) || 0);
      return {
        ...b,
        totalCostSoFar: Math.round(totalCostSoFar * 100) / 100,
      };
    });

    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const productName = typeof body.productName === "string" ? body.productName.trim() : "";
    const quantity = Number(body.quantity);
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const fabricId = typeof body.fabricId === "string" && body.fabricId ? body.fabricId : null;
    const fabricMetersConsumed = Number(body.fabricMetersConsumed);
    const estimatedCostPerUnit =
      body.estimatedCostPerUnit !== undefined && body.estimatedCostPerUnit !== ""
        ? Number(body.estimatedCostPerUnit)
        : null;
    let currentStage =
      typeof body.currentStage === "string" && ALLOWED_STAGES.has(body.currentStage)
        ? body.currentStage
        : "READY_FOR_PRODUCTION";

    if (!productName || Number.isNaN(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "productName and positive quantity are required" },
        { status: 400 }
      );
    }

    const actor = await getManufacturingActorName();

    const batch = await prisma.$transaction(async (tx: any) => {
      let batchCode = "";
      for (let i = 0; i < 12; i++) {
        const candidate = suggestBatchCode();
        const exists = await tx.mfgProductionBatch.findUnique({
          where: { batchCode: candidate },
        });
        if (!exists) {
          batchCode = candidate;
          break;
        }
      }
      if (!batchCode) throw new Error("Could not allocate batch code");

      const created = await tx.mfgProductionBatch.create({
        data: {
          batchCode,
          productName,
          quantity,
          currentStage,
          fabricId,
          notes,
          estimatedCostPerUnit:
            estimatedCostPerUnit !== null && !Number.isNaN(estimatedCostPerUnit)
              ? estimatedCostPerUnit
              : null,
        },
      });

      await tx.mfgProductionStageLog.create({
        data: {
          batchId: created.id,
          action: "CREATE_BATCH",
          fromStage: null,
          toStage: currentStage,
          payload: {
            productName,
            quantity,
            batchCode,
            fabricId,
            fabricMetersConsumed: Number.isFinite(fabricMetersConsumed) ? fabricMetersConsumed : 0,
            notes,
            estimatedCostPerUnit,
          },
          costAmount: 0,
          createdByName: actor,
        },
      });

      if (
        fabricId &&
        Number.isFinite(fabricMetersConsumed) &&
        fabricMetersConsumed > 0
      ) {
        const fabric = await tx.mfgFabric.findUnique({ where: { id: fabricId } });
        if (!fabric) throw new Error("Selected fabric not found");
        await executeFabricMovement(tx, {
          fabricId,
          type: "OUT",
          quantity: fabricMetersConsumed,
          quantityUnit: "m",
          rateAtMovement: fabric.costPerMeter,
          occurredAt: new Date(),
          remarks: `Opening consumption for batch ${batchCode}`,
          productionBatchId: created.id,
          correctsMovementId: null,
          actor,
        });
      }

      return created;
    });

    await logMfgAudit("MfgProductionBatch", batch.id, "CREATE", actor, {
      batchCode: batch.batchCode,
    });

    return NextResponse.json({ success: true, batch });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
