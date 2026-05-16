import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const sessions = await prisma.aIChatSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });

    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("[ZicaAI Mobile] History error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
