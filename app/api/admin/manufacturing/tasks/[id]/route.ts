import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    if (id.startsWith("PROD-")) {
      const batchId = id.replace("PROD-", "");
      const b = await prisma.mfgProductionBatch.findUnique({
        where: { id: batchId },
        include: {
          fabric: true,
          stageLogs: { orderBy: { createdAt: "desc" } },
          batchNotes: { orderBy: { createdAt: "desc" } },
          movements: { orderBy: { occurredAt: "desc" } },
          miscExpenses: { orderBy: { expenseDate: "desc" } },
        },
      });

      if (!b) {
        return NextResponse.json({ error: "Production batch not found" }, { status: 404 });
      }

      const virtualTask = {
        id: `PROD-${b.id}`,
        title: `Production: ${b.productName} (${b.batchCode})`,
        description: `Currently at: ${b.currentStage}. Quantity: ${b.quantity}`,
        status: "PENDING",
        priority: "HIGH",
        dueDate: new Date(new Date(b.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: b.createdAt,
        type: "PRODUCTION",
        batchId: b.id,
        batch: b,
      };

      return NextResponse.json(virtualTask);
    } else {
      const t = await prisma.mfgTask.findUnique({
        where: { id },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          batch: {
            include: {
              fabric: true,
              stageLogs: { orderBy: { createdAt: "desc" } },
              batchNotes: { orderBy: { createdAt: "desc" } },
              movements: { orderBy: { occurredAt: "desc" } },
              miscExpenses: { orderBy: { expenseDate: "desc" } },
            },
          },
        },
      });

      if (!t) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      return NextResponse.json(t);
    }
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const {
      title,
      description,
      priority,
      status,
      dueDate,
      assignedToId,
      workdriveFolderId,
      workdriveFolderName,
      workdriveUrl,
      approvalStatus,
      designName,
      designImage
    } = body;

    if (id.startsWith("PROD-")) {
      return NextResponse.json({ error: "Production tasks must be advanced through stage actions, not direct edits" }, { status: 400 });
    }

    const updated = await prisma.mfgTask.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
        ...(workdriveFolderId !== undefined ? { workdriveFolderId } : {}),
        ...(workdriveFolderName !== undefined ? { workdriveFolderName } : {}),
        ...(workdriveUrl !== undefined ? { workdriveUrl } : {}),
        ...(approvalStatus !== undefined ? { approvalStatus } : {}),
        ...(designName !== undefined ? { designName } : {}),
        ...(designImage !== undefined ? { designImage } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
