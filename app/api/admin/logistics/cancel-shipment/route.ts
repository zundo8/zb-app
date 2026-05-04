/**
 * POST /api/logistics/cancel-shipment — Cancel a shipment (admin only)
 * 
 * This route is protected by the middleware (admin session required).
 */

import { NextResponse } from "next/server";
import { cancelShipment } from "@/lib/services/logistics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { awb } = body;

    if (!awb) {
      return NextResponse.json({ error: "awb is required" }, { status: 400 });
    }

    const result = await cancelShipment(awb);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Logistics Cancel] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to cancel shipment" },
      { status: 500 }
    );
  }
}
