import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleAuthError } from "@/lib/auth/rbac";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function GET() {
  try {
    await requirePermission('ADMIN_USERS', 'view');
    const users = await prisma.user.findMany({
      include: { 
        permissions: true,
        creator: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(users);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePermission('ADMIN_USERS', 'edit');
    const creatorId = (session.user as any).id;
    
    const { name, email, role, permissions } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        role,
        passwordHash: hashedPassword,
        needsPasswordChange: true,
        createdBy: creatorId,
        permissions: {
          create: permissions.map((p: any) => ({
            module: p.module,
            canView: p.canView,
            canEdit: p.canEdit,
            canDelete: p.canDelete,
            pages: p.pages && p.pages.length > 0 ? p.pages.join(',') : null,
          }))
        }
      },
      include: { permissions: true }
    });

    await logAudit({
      action: "CREATE_USER",
      module: "ADMIN_USERS",
      targetId: user.id,
      metadata: { email: user.email, role: user.role }
    });

    return NextResponse.json({ user, tempPassword });
  } catch (error) {
    return handleAuthError(error);
  }
}
