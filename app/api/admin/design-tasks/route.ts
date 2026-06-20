import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";
import { createWorkspaceFolder } from "@/lib/workdrive/api";

export const dynamic = "force-dynamic";

// GET — list all design tasks
export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;

    const tasks = await prisma.mfgDesignTask.findMany({
      where: {
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(tasks);
  } catch (error: any) {
    return handleAuthError(error);
  }
}

// POST — create a new design task
export async function POST(req: Request) {
  try {
    const session = await requireAuth();

    const body = await req.json();
    const { title, description, orderId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const userId = (session.user as any)?.id;

    // Auto-create a WorkDrive folder for this design task
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}${mm}${dd}`;
    const folderName = `Design-${slug}-${dateStr}`;

    let workdriveFolderId: string | null = null;
    let workdriveFolderName: string | null = null;

    try {
      const folder = await createWorkspaceFolder(folderName);
      workdriveFolderId = folder.data?.id || null;
      workdriveFolderName = folder.data?.attributes?.name || folderName;
    } catch (err: any) {
      console.error("[DesignTask] Failed to create WorkDrive folder:", err.message);
    }

    const task = await prisma.mfgDesignTask.create({
      data: {
        title,
        description: description || null,
        orderId: orderId || null,
        status: "draft",
        workdriveFolderId,
        workdriveFolderName,
        createdById: userId || null,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

// PATCH — update a design task (status, approval, details)
export async function PATCH(req: Request) {
  try {
    const session = await requireAuth();

    const body = await req.json();
    const {
      id,
      title,
      description,
      orderId,
      status,
      approvedFileId,
      workdriveFolderId,
      workdriveFolderName,
      rejectionNotes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const userId = (session.user as any)?.id;

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (orderId !== undefined) updateData.orderId = orderId;
    if (workdriveFolderId !== undefined) updateData.workdriveFolderId = workdriveFolderId;
    if (workdriveFolderName !== undefined) updateData.workdriveFolderName = workdriveFolderName;

    // Approval flow
    if (status === "approved" && approvedFileId) {
      updateData.status = "approved";
      updateData.approvedFileId = approvedFileId;
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    } else if (status === "rejected") {
      updateData.status = "rejected";
      if (rejectionNotes) {
        updateData.description = (updateData.description || "") + `\n\n[Revision requested]: ${rejectionNotes}`;
      }
    } else if (status) {
      updateData.status = status;
    }

    const task = await prisma.mfgDesignTask.update({
      where: { id },
      data: updateData,
      include: {
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

// DELETE — delete a design task
export async function DELETE(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.mfgDesignTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
