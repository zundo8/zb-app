import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleAuthError } from "@/lib/auth/rbac";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        needsPasswordChange: false,
      }
    });

    await logAudit({
      action: "CHANGE_PASSWORD",
      module: "AUTH",
      targetId: userId,
      metadata: { method: "forced_or_voluntary" }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
