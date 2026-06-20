import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getManufacturingActorName } from "@/lib/manufacturing/admin-actor";
import { logMfgAudit } from "@/lib/manufacturing/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;

    if (userId) {
      // Return that user's performance events
      const events = await prisma.mfgEmployeePerformance.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json(events);
    } else {
      // Return aggregated score per user
      const users = await prisma.user.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          mfgPerformanceEvents: {
            select: {
              scoreDelta: true
            }
          }
        }
      });

      const aggregated = users
        .map((u) => {
          const sumDelta = u.mfgPerformanceEvents.reduce((acc, curr) => acc + curr.scoreDelta, 0);
          return {
            userId: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            score: 100 + sumDelta,
            eventsCount: u.mfgPerformanceEvents.length
          };
        })
        .filter((user) => user.eventsCount > 0); // Only return users with performance events as requested

      aggregated.sort((a, b) => b.score - a.score);

      return NextResponse.json(aggregated);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, eventType, scoreDelta, referenceId, referenceType, notes } = body;

    if (!userId || !eventType || scoreDelta === undefined) {
      return NextResponse.json({ error: "UserId, EventType, and ScoreDelta are required" }, { status: 400 });
    }

    const event = await prisma.mfgEmployeePerformance.create({
      data: {
        userId,
        eventType,
        scoreDelta: parseFloat(scoreDelta),
        referenceId: referenceId || null,
        referenceType: referenceType || null,
        notes: notes || null
      }
    });

    const actor = await getManufacturingActorName();
    await logMfgAudit("User", userId, "MANUAL_PERFORMANCE_EVENT", actor, { eventType, scoreDelta });

    return NextResponse.json(event);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
