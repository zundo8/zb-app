/**
 * GET /api/logistics/track — Track a shipment
 * 
 * Accepts: ?awb=xxx or ?order_id=xxx
 * Returns tracking status, scan history, ETA.
 */

import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getTrackingStatus } from "@/lib/services/logistics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const awb = req.nextUrl.searchParams.get("awb");
    const orderId = req.nextUrl.searchParams.get("order_id");

    if (!awb && !orderId) {
      return NextResponse.json({ error: "awb or order_id is required" }, { status: 400 });
    }

    let trackingNumber = awb;

    // If order_id provided, look up AWB from shipments table
    if (!trackingNumber && orderId) {
      const shipment = await prisma.shipment.findFirst({
        where: { orderId },
        orderBy: { createdAt: "desc" },
      });
      if (!shipment) {
        return NextResponse.json({ error: "No shipment found for this order" }, { status: 404 });
      }
      trackingNumber = shipment.awb || shipment.trackingNumber;
    }

    if (!trackingNumber) {
      return NextResponse.json({ error: "No tracking number available" }, { status: 404 });
    }

    // Get tracking from logistics service (Delhivery API + DB update)
    const tracking = await getTrackingStatus(trackingNumber);

    // Update shipments table with latest data
    await prisma.shipment.updateMany({
      where: {
        OR: [
          { trackingNumber },
          { awb: trackingNumber },
        ],
      },
      data: {
        status: tracking.status,
        currentLocation: tracking.location || undefined,
        estimatedDelivery: tracking.estimatedDelivery ? new Date(tracking.estimatedDelivery) : undefined,
        events: JSON.stringify(tracking.events),
      },
    });

    return NextResponse.json({
      status: tracking.status,
      scan_history: tracking.events,
      estimated_delivery: tracking.estimatedDelivery,
      current_location: tracking.location,
      tracking_url: tracking.trackingUrl,
      awb: trackingNumber,
    });
  } catch (error: any) {
    console.error("[Logistics Track] Error:", error.message);
    return NextResponse.json({ error: "Failed to fetch tracking" }, { status: 500 });
  }
}
