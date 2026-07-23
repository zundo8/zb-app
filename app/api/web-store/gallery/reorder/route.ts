import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// POST: Batch reorder gallery images
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body as { items: { id: string; position: number }[] };

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    // Execute updates in a transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.webStoreGalleryImage.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );

    return NextResponse.json({ success: true, message: "Gallery order updated successfully" });
  } catch (error: any) {
    console.error("[Web Store Gallery Reorder POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
