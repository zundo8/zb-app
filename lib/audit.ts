import prisma from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

/**
 * Logs an event to the AuditLog table.
 */
export async function logAudit({
  action,
  module,
  targetId,
  metadata,
  ipAddress,
  userAgent,
}: {
  action: string;
  module?: string;
  targetId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        module,
        targetId,
        metadata: metadata ? (typeof metadata === 'string' ? { info: metadata } : metadata) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}
