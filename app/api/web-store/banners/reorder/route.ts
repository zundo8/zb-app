import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body; // Array of banner IDs in new order

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid banner IDs" }, { status: 400 });
    }

    // Run updates in a database transaction for data integrity
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.webStoreBanner.update({
          where: { id },
          data: { position: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true, message: "Banners reordered successfully" });
  } catch (error: any) {
    console.error("[Web Store Banners Reorder POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
