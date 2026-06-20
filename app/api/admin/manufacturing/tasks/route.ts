import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";
import { suggestBatchCode } from "@/lib/manufacturing/sku";
import { sendZohoEmail, emailTaskCreated } from "@/lib/services/zohoMailService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const includeProduction = searchParams.get("includeProduction") === "true";

    // 1. Fetch manual & other custom task types
    const manualTasks = await prisma.mfgTask.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        batch: {
          select: {
            id: true,
            batchCode: true,
            productName: true,
            currentStage: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
    });

    let combinedTasks = manualTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority as "LOW" | "MEDIUM" | "HIGH",
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      type: t.type,
      batch: t.batch,
      assignedTo: t.assignedTo,
      assignedToId: t.assignedToId,
      workdriveUrl: t.workdriveUrl,
      workdriveFolderId: t.workdriveFolderId,
      approvalStatus: t.approvalStatus,
      designName: t.designName,
      designImage: t.designImage
    }));

    // 2. If requested, fetch pending production batches as tasks
    if (includeProduction && (!type || type === "PRODUCTION")) {
      const pendingBatches = await prisma.mfgProductionBatch.findMany({
        where: {
          NOT: [
            { currentStage: "QC_PASSED" },
            { currentStage: "REJECTED_REWORK" },
          ],
        },
        orderBy: { updatedAt: "desc" },
      });

      const productionTasks = pendingBatches.map(b => ({
        id: `PROD-${b.id}`,
        title: `Production: ${b.productName} (${b.batchCode})`,
        description: `Currently at: ${b.currentStage}. Quantity: ${b.quantity}`,
        status: "PENDING",
        priority: "HIGH" as const,
        dueDate: new Date(new Date(b.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
        createdAt: b.createdAt,
        type: "PRODUCTION",
        batch: {
          id: b.id,
          batchCode: b.batchCode,
          productName: b.productName,
          currentStage: b.currentStage,
        },
        assignedTo: null,
        assignedToId: null,
        workdriveUrl: null,
        workdriveFolderId: null,
        approvalStatus: null,
        designName: null,
        designImage: null
      }));

      combinedTasks = [...combinedTasks, ...productionTasks];
      // Re-sort by priority and creation date
      combinedTasks.sort((a: any, b: any) => {
        const priorityScore: any = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        if (priorityScore[b.priority] !== priorityScore[a.priority]) {
          return priorityScore[b.priority] - priorityScore[a.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    return NextResponse.json(combinedTasks);
  } catch (e: any) {
    console.error("Fetch Tasks Error:", e);
    const errorMsg = e.message?.includes("does not exist") 
      ? "Database table 'MfgTask' is missing. Please run 'npx prisma db push'."
      : e.message;
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      title, 
      description, 
      priority, 
      dueDate, 
      batchId, 
      type, 
      assignedToId, 
      workdriveUrl, 
      workdriveFolderId, 
      approvalStatus, 
      designName, 
      designImage 
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const actor = await getManufacturingActorName();

    const task = await prisma.mfgTask.create({
      data: {
        title,
        description,
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        batchId: batchId || null,
        createdByName: actor,
        type: type || "MANUAL",
        assignedToId: assignedToId || null,
        workdriveUrl: workdriveUrl || null,
        workdriveFolderId: workdriveFolderId || null,
        approvalStatus: approvalStatus || (type === "DESIGN_APPROVAL" ? "PENDING" : null),
        designName: designName || null,
        designImage: designImage || null,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Notify assignee if assigned
    if (task.assignedTo && task.assignedTo.email) {
      try {
        const { subject, html } = emailTaskCreated({
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
          description: task.description || undefined,
          createdBy: actor,
        });
        await sendZohoEmail({
          fromAddress: "admin@zicabella.com",
          toAddress: task.assignedTo.email,
          subject,
          content: html,
          mailFormat: "html"
        });
      } catch (err: any) {
        console.error("[Task Notification Error]:", err.message);
      }
    }

    await logMfgAudit("MfgTask", task.id, "CREATE", actor, { title: task.title });

    return NextResponse.json({ success: true, task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { 
      id, 
      status, 
      title, 
      description, 
      priority, 
      dueDate,
      type,
      assignedToId,
      workdriveUrl,
      workdriveFolderId,
      approvalStatus,
      designName,
      designImage,
      transition, // transition action: 'SEND_TO_PRODUCTION' | 'SEND_TO_VENDOR_SELECTION'
      quantity // For sending to production
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const actor = await getManufacturingActorName();

    // Handle Workflow Transitions
    if (transition === "SEND_TO_PRODUCTION") {
      const sourceTask = await prisma.mfgTask.findUnique({
        where: { id },
      });

      if (!sourceTask) {
        return NextResponse.json({ error: "Source task not found" }, { status: 404 });
      }

      const prodQty = Number(quantity) || 100; // default quantity
      const prodName = sourceTask.designName || sourceTask.title;

      // Allocate batch code
      let batchCode = "";
      for (let i = 0; i < 12; i++) {
        const candidate = suggestBatchCode();
        const exists = await prisma.mfgProductionBatch.findFirst({
          where: { batchCode: candidate },
        });
        if (!exists) {
          batchCode = candidate;
          break;
        }
      }

      if (!batchCode) {
        return NextResponse.json({ error: "Could not allocate batch code" }, { status: 500 });
      }

      const batch = await prisma.$transaction(async (tx) => {
        const newBatch = await tx.mfgProductionBatch.create({
          data: {
            batchCode,
            productName: prodName,
            quantity: prodQty,
            currentStage: "READY_FOR_PRODUCTION",
            notes: `Spun off from Approved Design Task: ${sourceTask.title}. Folder: ${sourceTask.workdriveUrl || ''}`,
          }
        });

        await tx.mfgProductionStageLog.create({
          data: {
            batchId: newBatch.id,
            action: "CREATE_BATCH",
            fromStage: null,
            toStage: "READY_FOR_PRODUCTION",
            payload: {
              productName: prodName,
              quantity: prodQty,
              batchCode,
              notes: `Created from Design Approval: ${sourceTask.title}`
            },
            costAmount: 0,
            createdByName: actor,
          }
        });

        // Update the task to link it to this batch and mark task as COMPLETED
        await tx.mfgTask.update({
          where: { id },
          data: {
            batchId: newBatch.id,
            status: "COMPLETED",
            approvalStatus: "APPROVED",
            completedAt: new Date()
          }
        });

        return newBatch;
      });

      await logMfgAudit("MfgProductionBatch", batch.id, "CREATE", actor, {
        batchCode: batch.batchCode,
        triggeredFromTask: id
      });

      return NextResponse.json({ success: true, batch, message: "Design successfully sent to Production Tracker!" });
    }

    if (transition === "SEND_TO_VENDOR_SELECTION") {
      const sourceTask = await prisma.mfgTask.findUnique({
        where: { id },
      });

      if (!sourceTask) {
        return NextResponse.json({ error: "Source task not found" }, { status: 404 });
      }

      const dName = sourceTask.designName || sourceTask.title;

      const vendorTask = await prisma.$transaction(async (tx) => {
        // Create new VENDOR_SELECTION task
        const newTask = await tx.mfgTask.create({
          data: {
            title: `Select Vendor for Design: ${dName}`,
            description: `Design approval completed for ${dName}. Please search and coordinate with suitable vendors. Folder: ${sourceTask.workdriveUrl || ''}`,
            priority: "MEDIUM",
            type: "VENDOR_SELECTION",
            assignedToId: sourceTask.assignedToId,
            workdriveUrl: sourceTask.workdriveUrl,
            workdriveFolderId: sourceTask.workdriveFolderId,
            designName: dName,
            designImage: sourceTask.designImage,
            createdByName: actor,
          }
        });

        // Mark design approval task as COMPLETED
        await tx.mfgTask.update({
          where: { id },
          data: {
            status: "COMPLETED",
            approvalStatus: "APPROVED",
            completedAt: new Date()
          }
        });

        return newTask;
      });

      await logMfgAudit("MfgTask", vendorTask.id, "CREATE", actor, { title: vendorTask.title });

      return NextResponse.json({ success: true, task: vendorTask, message: "Design forwarded to Vendor Selection process." });
    }

    // Standard task update
    const oldTask = await prisma.mfgTask.findUnique({
      where: { id },
      select: { assignedToId: true }
    });

    const task = await prisma.mfgTask.update({
      where: { id },
      data: {
        ...(status ? { status, completedAt: status === "COMPLETED" ? new Date() : null } : {}),
        ...(title ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority ? { priority } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : dueDate === null ? { dueDate: null } : {}),
        ...(type ? { type } : {}),
        ...(assignedToId !== undefined ? { assignedToId } : {}),
        ...(workdriveUrl !== undefined ? { workdriveUrl } : {}),
        ...(workdriveFolderId !== undefined ? { workdriveFolderId } : {}),
        ...(approvalStatus !== undefined ? { approvalStatus } : {}),
        ...(designName !== undefined ? { designName } : {}),
        ...(designImage !== undefined ? { designImage } : {}),
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Notify assignee if newly assigned or assignment changed
    if (task.assignedTo && task.assignedToId !== oldTask?.assignedToId) {
      try {
        const { subject, html } = emailTaskCreated({
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
          description: task.description || undefined,
          createdBy: actor,
        });
        await sendZohoEmail({
          fromAddress: "admin@zicabella.com",
          toAddress: task.assignedTo.email,
          subject,
          content: html,
          mailFormat: "html"
        });
      } catch (err: any) {
        console.error("[Task Notification Error]:", err.message);
      }
    }

    await logMfgAudit("MfgTask", task.id, "UPDATE", actor, { status: task.status });

    return NextResponse.json({ success: true, task });
  } catch (e: any) {
    console.error("Update Task Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const actor = await getManufacturingActorName();

    await prisma.mfgTask.delete({
      where: { id },
    });

    await logMfgAudit("MfgTask", id, "DELETE", actor, {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
