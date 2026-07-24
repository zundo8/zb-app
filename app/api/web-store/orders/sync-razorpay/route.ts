import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { syncPendingWebStoreOrders } from "@/lib/services/razorpaySyncService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let orderIds: string[] | undefined = undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.orderIds)) {
        orderIds = body.orderIds;
      }
    } catch {
      // Body empty or invalid JSON is fine (sync all pending)
    }

    const result = await syncPendingWebStoreOrders(orderIds);

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      syncedOrders: result.syncedOrders,
    });
  } catch (error: any) {
    console.error("[Web Store Sync Razorpay POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
