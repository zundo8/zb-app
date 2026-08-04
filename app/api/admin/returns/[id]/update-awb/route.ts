import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { trackDelhiveryShipment } from "@/lib/delhivery";
import { updateOrderTracking } from "@/lib/delhivery/tracking";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { awb } = body;

    if (!awb || !awb.trim()) {
      return NextResponse.json({ error: "AWB number is required" }, { status: 400 });
    }

    const cleanAwb = awb.trim();

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!returnRequest) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }

    // Update ReturnRequest reverseAwb
    await prisma.returnRequest.update({
      where: { id },
      data: { reverseAwb: cleanAwb }
    });

    // Upsert reverse shipment
    await prisma.shipment.upsert({
      where: { awb: cleanAwb },
      update: {
        courier: "Delhivery",
        type: "reverse_pickup",
        trackingUrl: `https://www.delhivery.com/track/package/${cleanAwb}`
      },
      create: {
        orderId: returnRequest.orderId,
        awb: cleanAwb,
        trackingNumber: cleanAwb,
        courier: "Delhivery",
        status: "pickup_pending",
        type: "reverse_pickup",
        trackingUrl: `https://www.delhivery.com/track/package/${cleanAwb}`
      }
    });

    // Live sync with Delhivery API
    let liveTrackingData = null;
    try {
      const delhiveryRes = await trackDelhiveryShipment(cleanAwb);
      const pkg = delhiveryRes?.ShipmentData?.[0]?.Shipment || delhiveryRes?.packages?.[0];
      if (pkg) {
        const liveStatus = pkg.Status?.Status || pkg.CurrentStatus || pkg.status || 'Manifested';
        const location = pkg.Status?.StatusLocation || pkg.ScannedLocation || '';
        const instructions = pkg.Status?.Instructions || pkg.StatusType || '';
        const statusDateTime = pkg.Status?.StatusDateTime || new Date().toISOString();

        await updateOrderTracking({
          awb: cleanAwb,
          shopifyOrderId: returnRequest.order.shopifyOrderId || returnRequest.orderId,
          status: liveStatus,
          statusDateTime,
          statusType: liveStatus,
          location,
          instructions
        });
        liveTrackingData = pkg;
      }
    } catch (dErr: any) {
      console.warn(`[Update Return AWB] Delhivery live sync note: ${dErr.message}`);
    }

    return NextResponse.json({
      success: true,
      awb: cleanAwb,
      liveTrackingData
    });
  } catch (error: any) {
    console.error("Update Return AWB Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update AWB" }, { status: 500 });
  }
}
