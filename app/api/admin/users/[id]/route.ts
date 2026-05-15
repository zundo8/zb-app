import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSuperAdmin();
    const currentUserId = (session.user as any).id;
    const { id } = params;

    if (id === currentUserId) {
      return NextResponse.json({ error: "Cannot modify your own account via this panel" }, { status: 400 });
    }

    const { name, email, role, isActive, permissions } = await req.json();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        permissions: permissions ? {
          deleteMany: {},
          create: permissions.map((p: any) => ({
            module: p.module,
            canView: p.canView,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
          }))
        } : undefined
      },
      include: { permissions: true }
    });

    await logAudit({
      action: "UPDATE_USER",
      module: "ADMIN_USERS",
      targetId: user.id,
      metadata: { 
        changedFields: Object.keys(updateData),
        permissionsUpdated: !!permissions 
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSuperAdmin();
    const currentUserId = (session.user as any).id;
    const { id } = params;

    if (id === currentUserId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const user = await prisma.user.delete({
      where: { id }
    });

    await logAudit({
      action: "DELETE_USER",
      module: "ADMIN_USERS",
      targetId: id,
      metadata: { email: user.email }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
