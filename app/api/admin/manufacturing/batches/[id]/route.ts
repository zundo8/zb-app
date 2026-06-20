import { NextResponse } from "next/server";
import prisma from "@/lib/db";

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
        stageLogs: { orderBy: { createdAt: "desc" } },
        miscExpenses: { orderBy: { expenseDate: "desc" } },
      },
    });
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(batch);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { workdriveFolderId, workdriveUrl } = body;

    const updated = await prisma.mfgProductionBatch.update({
      where: { id },
      data: {
        ...(workdriveFolderId !== undefined ? { workdriveFolderId } : {}),
        ...(workdriveUrl !== undefined ? { workdriveUrl } : {}),
      },
    });

    return NextResponse.json({ success: true, batch: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
