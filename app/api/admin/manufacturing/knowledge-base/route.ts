import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { styleCode: { contains: search, mode: "insensitive" } },
        { productName: { contains: search, mode: "insensitive" } }
      ];
    }

    const entries = await prisma.mfgProductKnowledgeBase.findMany({
      where,
      include: {
        designer: {
          select: { id: true, name: true, email: true }
        },
        vendor: {
          select: { id: true, name: true, category: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(entries);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
