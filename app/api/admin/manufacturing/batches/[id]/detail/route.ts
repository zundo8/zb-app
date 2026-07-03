import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  computeBatchCostBreakdown,
  type StageLogLike,
} from "@/lib/manufacturing/batch-cost-breakdown";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const batch = await prisma.mfgProductionBatch.findUnique({
      where: { id },
      include: {
        fabric: true,
        stageLogs: { orderBy: { createdAt: "asc" } },
        miscExpenses: { orderBy: { expenseDate: "desc" } },
        batchNotes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fabricMovs = await prisma.mfgFabricMovement.findMany({
      where: { productionBatchId: id, type: "OUT" },
    });

    const fabricTotal = fabricMovs.reduce((s: any, m: any) => s + (m.totalValue || 0), 0);
    const miscTotal = batch.miscExpenses.reduce((s: any, m: any) => s + m.amount, 0);

    const breakdown = computeBatchCostBreakdown({
      quantity: batch.quantity,
      stageLogs: batch.stageLogs as StageLogLike[],
      fabricMovementsTotalValue: fabricTotal,
      miscTotal,
    });

    const timeline = batch.stageLogs.map((l: any) => ({
      id: l.id,
      action: l.action,
      fromStage: l.fromStage,
      toStage: l.toStage,
      costAmount: l.costAmount,
      payload: l.payload,
      createdByName: l.createdByName,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json({
      batch: {
        id: batch.id,
        batchCode: batch.batchCode,
        productName: batch.productName,
        quantity: batch.quantity,
        currentStage: batch.currentStage,
        washCostTotal: batch.washCostTotal,
        notes: batch.notes,
        estimatedCostPerUnit: batch.estimatedCostPerUnit,
        fabricId: batch.fabricId,
        fabric: batch.fabric,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
      },
      timeline,
      fabricMovements: fabricMovs,
      miscExpenses: batch.miscExpenses,
      batchNotes: batch.batchNotes,
      breakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
