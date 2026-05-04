/**
 * GET /api/orders/tracking — Real tracking via Delhivery/logistics service
 * 
 * Accepts: ?id=<tracking_number> or ?order_id=<order_id>
 * Returns tracking status from Delhivery API or DB fallback.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTrackingStatus } from "@/lib/services/logistics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get("id");
    const orderId = searchParams.get("order_id");

    if (!trackingId && !orderId) {
      return NextResponse.json({ error: "Tracking ID or order_id required" }, { status: 400 });
    }

    let trackingNumber = trackingId;

    // If order_id provided, look up tracking number from shipments table
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

    // Get real tracking status from logistics service (Delhivery/Shiprocket/DB)
    const tracking = await getTrackingStatus(trackingNumber);

    // Also fetch shipment record for enrichment
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingNumber },
          { awb: trackingNumber },
        ],
      },
      include: {
        order: { select: { id: true, shopifyOrderId: true } },
      },
    });

    return NextResponse.json({
      trackingId: trackingNumber,
      awb: shipment?.awb || trackingNumber,
      status: tracking.status,
      location: tracking.location,
      estimatedDelivery: tracking.estimatedDelivery,
      trackingUrl: tracking.trackingUrl,
      activities: tracking.events,
      orderId: shipment?.order?.id,
      shopifyOrderId: shipment?.order?.shopifyOrderId,
      courier: shipment?.courier,
      labelUrl: shipment?.labelUrl,
    });
  } catch (error: any) {
    console.error("[Tracking] Error:", error.message);
    return NextResponse.json({ error: "Failed to fetch tracking information" }, { status: 500 });
  }
}
