import { NextRequest, NextResponse } from "next/server";
import { syncPendingWebStoreOrders } from "@/lib/services/razorpaySyncService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== cronSecret && req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncPendingWebStoreOrders();
    return NextResponse.json({
      success: true,
      syncedCount: result.updatedCount,
      orders: result.syncedOrders,
    });
  } catch (error: any) {
    console.error("[Sync Pending Orders Cron] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
