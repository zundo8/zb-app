import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

function monthRangeUTC(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function travelFromPayload(p: unknown): number {
  if (!p || typeof p !== "object") return 0;
  const o = p as Record<string, unknown>;
  const a = Number(o.travel ?? o.travelExpense ?? o.logisticsExpense ?? 0);
  return Number.isFinite(a) ? a : 0;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId") || undefined;
    const stage = searchParams.get("stage") || undefined;
    let from = searchParams.get("from");
    let to = searchParams.get("to");
    if (!from || !to) {
      const { start, end } = monthRangeUTC();
      if (!from) from = start.toISOString();
      if (!to) to = end.toISOString();
    }
    const fromD = new Date(from!);
    const toD = new Date(to!);

    const logWhere = {
      createdAt: { gte: fromD, lte: toD },
      ...(batchId ? { batchId } : {}),
      ...(stage
        ? {
            batch: { currentStage: stage },
          }
        : {}),
    };

    const logs = await prisma.mfgProductionStageLog.findMany({
      where: logWhere,
      include: { batch: { select: { id: true, batchCode: true, quantity: true, currentStage: true } } },
    });

    const misc = await prisma.mfgMiscExpense.findMany({
      where: {
        expenseDate: { gte: fromD, lte: toD },
        ...(batchId ? { batchId } : {}),
        ...(stage
          ? {
              OR: [{ batchId: null }, { batch: { currentStage: stage } }],
            }
          : {}),
      },
    });

    const fabricMovs = await prisma.mfgFabricMovement.findMany({
      where: {
        type: "OUT",
        productionBatchId: { not: null },
        occurredAt: { gte: fromD, lte: toD },
        ...(batchId ? { productionBatchId: batchId } : {}),
        ...(stage
          ? {
              batch: { currentStage: stage },
            }
          : {}),
      },
    });

    let wash = 0;
    let printing = 0;
    let embroidery = 0;
    let travel = 0;

    for (const l of logs) {
      const t = travelFromPayload(l.payload);
      travel += t;
      const ca = l.costAmount || 0;
      if (l.action === "SEND_WASH" || l.action === "RETURN_WASH") wash += ca;
      else if (l.action === "SEND_PRINTING" || l.action === "RETURN_PRINTING") printing += ca;
      else if (l.action === "SEND_EMBROIDERY" || l.action === "RETURN_EMBROIDERY")
        embroidery += ca;
    }

    const fabricTotal = fabricMovs.reduce((s: any, m: any) => s + (m.totalValue || 0), 0);
    const miscTotal = misc.reduce((s: any, m: any) => s + m.amount, 0);
    const stageLogTotal = logs.reduce((s: any, l: any) => s + (l.costAmount || 0), 0);
    const grand = fabricTotal + stageLogTotal + miscTotal;

    const batchIds = new Set<string>();
    logs.forEach((l: any) => batchIds.add(l.batchId));
    misc.forEach((m: any) => {
      if (m.batchId) batchIds.add(m.batchId);
    });
    fabricMovs.forEach((m: any) => {
      if (m.productionBatchId) batchIds.add(m.productionBatchId);
    });

    if (batchId) batchIds.add(batchId);

    const idList = Array.from(batchIds);
    let batches: Awaited<ReturnType<typeof prisma.mfgProductionBatch.findMany>>;
    if (batchId) {
      batches = await prisma.mfgProductionBatch.findMany({ where: { id: batchId } });
    } else if (stage) {
      batches = await prisma.mfgProductionBatch.findMany({ where: { currentStage: stage } });
    } else if (idList.length > 0) {
      batches = await prisma.mfgProductionBatch.findMany({
        where: { id: { in: idList } },
      });
    } else {
      batches = [];
    }

    const byBatch = batches.map((b: any) => {
      const bLogs = logs.filter((l: any) => l.batchId === b.id);
      const bMisc = misc.filter((m: any) => m.batchId === b.id);
      const bFab = fabricMovs.filter((m: any) => m.productionBatchId === b.id);

      let bw = 0;
      let bp = 0;
      let be = 0;
      let bTravel = 0;
      for (const l of bLogs) {
        bTravel += travelFromPayload(l.payload);
        const ca = l.costAmount || 0;
        if (l.action === "SEND_WASH" || l.action === "RETURN_WASH") bw += ca;
        else if (l.action === "SEND_PRINTING" || l.action === "RETURN_PRINTING") bp += ca;
        else if (l.action === "SEND_EMBROIDERY" || l.action === "RETURN_EMBROIDERY") be += ca;
      }
      const bFabric = bFab.reduce((s: any, m: any) => s + (m.totalValue || 0), 0);
      const bMiscSum = bMisc.reduce((s: any, m: any) => s + m.amount, 0);
      const total = bFabric + bLogs.reduce((s: any, l: any) => s + (l.costAmount || 0), 0) + bMiscSum;
      const qty = Math.max(1, b.quantity);
      const washRounded = Math.round(bw * 100) / 100;
      return {
        batchId: b.id,
        batchCode: b.batchCode,
        productName: b.productName,
        quantity: b.quantity,
        currentStage: b.currentStage,
        fabricCost: Math.round(bFabric * 100) / 100,
        washCost: washRounded,
        washCostPerUnit: Math.round((washRounded / qty) * 100) / 100,
        printingCost: Math.round(bp * 100) / 100,
        embroideryCost: Math.round(be * 100) / 100,
        travelLogistics: Math.round(bTravel * 100) / 100,
        miscellaneous: Math.round(bMiscSum * 100) / 100,
        totalCost: Math.round(total * 100) / 100,
        costPerUnit: Math.round((total / qty) * 100) / 100,
      };
    });

    return NextResponse.json({
      range: { from: fromD.toISOString(), to: toD.toISOString() },
      summary: {
        totalWashSpend: Math.round(wash * 100) / 100,
        totalPrintingSpend: Math.round(printing * 100) / 100,
        totalEmbroiderySpend: Math.round(embroidery * 100) / 100,
        totalTravelLogistics: Math.round(travel * 100) / 100,
        totalFabricAttributed: Math.round(fabricTotal * 100) / 100,
        totalMiscellaneous: Math.round(miscTotal * 100) / 100,
        grandTotalManufacturing: Math.round(grand * 100) / 100,
      },
      batches: byBatch.sort((a: any, b: any) => a.batchCode.localeCompare(b.batchCode)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
