import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, fulfillmentStatus, paymentStatus } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid order IDs" }, { status: 400 });
    }

    const data: any = {};
    if (fulfillmentStatus !== undefined) data.fulfillmentStatus = fulfillmentStatus;
    if (paymentStatus !== undefined) data.paymentStatus = paymentStatus;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updateResult = await prisma.webStoreOrder.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data,
    });

    return NextResponse.json({
      success: true,
      updatedCount: updateResult.count,
    });
  } catch (error: any) {
    console.error("[Web Store Orders Bulk PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
