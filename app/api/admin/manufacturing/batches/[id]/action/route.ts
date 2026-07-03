import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function travelFromPayload(p: Record<string, unknown>): number {
  return num(p.travel, num(p.travelExpense, num(p.logisticsExpense, 0)));
}

function computeCost(body: Record<string, unknown>): number {
  if (body.costAmount !== undefined) return num(body.costAmount);
  if (body.totalCost !== undefined) return num(body.totalCost);
  const qty = num(body.quantity);
  const per = num(body.pricePerUnit ?? body.costPerUnit ?? body.printingCostPerUnit ?? body.embroideryCostPerUnit);
  const travel = travelFromPayload(body);
  return Math.round((qty * per + travel) * 100) / 100;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "");

    const batch = (await prisma.mfgProductionBatch.findUnique({ where: { id } })) as any;
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const actor = await getManufacturingActorName();
    const fromStage = batch.currentStage;
    let toStage = fromStage;
    let washCostIncrement = 0;
    const payload = { ...body } as Prisma.InputJsonValue;
    let costAmount = 0;

    switch (action) {
      case "START_CUTTING":
        if (batch.isCuttingDone) return NextResponse.json({ error: "Cutting already completed" }, { status: 400 });
        toStage = "IN_PRODUCTION_CUTTING";
        break;
      case "SEND_STITCHING":
        if (batch.isStitchingDone) return NextResponse.json({ error: "Stitching already completed" }, { status: 400 });
        toStage = "IN_PRODUCTION_STITCHING";
        costAmount = computeCost(body);
        break;
      case "RETURN_STITCHING":
        toStage = "IN_PRODUCTION_STITCHING"; // Or just keep it there
        costAmount = computeCost(body);
        break;
      case "SEND_WASH":
        if (batch.isWashingDone) return NextResponse.json({ error: "Washing already completed" }, { status: 400 });
        toStage = "SENT_WASH";
        costAmount = computeCost(body);
        break;
      case "RETURN_WASH":
        toStage = "RETURNED_COMBINED";
        costAmount = num(body.washTotalCost, computeCost(body));
        washCostIncrement = costAmount;
        break;
      case "SEND_PRINTING":
        if (batch.isPrintingDone) return NextResponse.json({ error: "Printing already completed" }, { status: 400 });
        toStage = "SENT_PRINTING";
        costAmount = computeCost(body);
        break;
      case "RETURN_PRINTING":
        toStage = "RETURNED_COMBINED";
        costAmount = computeCost(body);
        break;
      case "SEND_EMBROIDERY":
        if (batch.isEmbroideryDone) return NextResponse.json({ error: "Embroidery already completed" }, { status: 400 });
        toStage = "SENT_EMBROIDERY";
        costAmount = computeCost(body);
        break;
      case "RETURN_EMBROIDERY":
        toStage = "RETURNED_COMBINED";
        costAmount = computeCost(body);
        break;
      case "MARK_SAMPLE":
        if (batch.isSampleDone) return NextResponse.json({ error: "Sample already completed" }, { status: 400 });
        toStage = "SENT_SAMPLE";
        costAmount = num(body.costAmount, 0);
        break;
      case "QC_PASS":
        if (fromStage === "SENT_SAMPLE") {
          toStage = "READY_FOR_PRODUCTION";
        } else {
          toStage = "QC_PASSED";
        }
        costAmount = num(body.costAmount, 0);
        break;
      case "QC_REJECT":
        toStage = "REJECTED_REWORK";
        costAmount = num(body.costAmount, 0);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.mfgProductionStageLog.create({
        data: {
          batchId: id,
          action,
          fromStage,
          toStage,
          payload,
          costAmount,
          createdByName: actor,
        },
      });

      const updateData: any = {
        currentStage: toStage,
        ...(washCostIncrement ? { washCostTotal: { increment: washCostIncrement } } : {}),
      };

      if (action === "QC_PASS" && fromStage === "SENT_SAMPLE") updateData.isSampleDone = true;
      if (action === "START_CUTTING") updateData.isCuttingDone = true;
      if (action === "RETURN_STITCHING" || action === "SEND_STITCHING") updateData.isStitchingDone = true;
      if (action === "RETURN_PRINTING") updateData.isPrintingDone = true;
      if (action === "RETURN_EMBROIDERY") updateData.isEmbroideryDone = true;
      if (action === "RETURN_WASH") updateData.isWashingDone = true;

      return tx.mfgProductionBatch.update({
        where: { id },
        data: updateData,
      });
    });

    await logMfgAudit("MfgProductionBatch", id, action, actor, { toStage, costAmount });

    return NextResponse.json({ success: true, batch: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
