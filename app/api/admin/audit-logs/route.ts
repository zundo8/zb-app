import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requirePermission('AUDIT_LOG', 'view');
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    const logs = await prisma.auditLog.findMany({
      take: limit,
      skip: skip,
      include: {
        user: {
          select: { name: true, email: true, role: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    const total = await prisma.auditLog.count();

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    return handleAuthError(error);
  }
}
