import { NextRequest, NextResponse } from "next/server";
import { syncPendingWebStoreOrders } from "@/lib/services/razorpaySyncService";
import prisma from "@/lib/db";

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

    // Log ping to SyncLog for dead-man's-switch health tracking
    try {
      await prisma.syncLog.create({
        data: {
          orderId: "system",
          action: "CRON_PING_ORDER_SYNC",
          status: "SUCCESS",
          payload: JSON.stringify({ syncedCount: result.updatedCount }),
        }
      });
    } catch (logErr) {
      console.error("[Sync Pending Orders Cron] Failed to log cron ping:", logErr);
    }

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
