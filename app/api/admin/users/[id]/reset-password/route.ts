import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleAuthError } from "@/lib/auth/rbac";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission('ADMIN_USERS', 'edit');
    const { id } = params;

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        needsPasswordChange: true,
      }
    });

    await logAudit({
      action: "RESET_PASSWORD",
      module: "ADMIN_USERS",
      targetId: user.id,
      metadata: { email: user.email }
    });

    return NextResponse.json({ success: true, tempPassword });
  } catch (error) {
    return handleAuthError(error);
  }
}
