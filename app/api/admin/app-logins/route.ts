import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [logins, total] = await Promise.all([
      prisma.appLogin.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: skip,
      }),
      prisma.appLogin.count()
    ]);

    return NextResponse.json({ logins, total });
  } catch (error: any) {
    console.error("Fetch app logins error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
