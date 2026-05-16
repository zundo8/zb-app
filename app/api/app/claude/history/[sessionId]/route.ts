import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const messages = await prisma.aIChatMessage.findMany({
      where: { sessionId: params.sessionId },
      orderBy: { createdAt: "asc" }
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("[ZicaAI Mobile] Session History error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
