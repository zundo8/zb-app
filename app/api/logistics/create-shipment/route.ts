/**
 * POST /api/logistics/create-shipment — Create a Delhivery shipment
 * 
 * Idempotent: if AWB already exists for this order, returns existing.
 * Creates shipment via logistics service and stores in DB.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { shipOrder } from "@/lib/services/logistics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id, name, address1, city, province, zip, country, phone, weight, cod, payment_mode } = body;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    // Check if shipment already exists for this order
    const existingShipment = await prisma.shipment.findFirst({
      where: { orderId: order_id },
    });

    if (existingShipment?.awb || existingShipment?.trackingNumber) {
      return NextResponse.json({
        awb: existingShipment.awb || existingShipment.trackingNumber,
        label_url: existingShipment.labelUrl,
        success: true,
        existing: true,
      });
    }

    // Get order items
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const items = order.items.map((i: any) => ({
      title: i.title,
      sku: i.sku || undefined,
      quantity: i.quantity,
      price: i.price,
    }));

    const address = {
      name: name || "Customer",
      address1: address1 || "",
      city: city || "",
      province: province || "",
      zip: zip || "",
      country: country || "India",
      phone: phone || "",
    };

    // If address not provided, try to parse from order
    if (!address1 && order.shippingAddress) {
      try {
        const parsed = JSON.parse(order.shippingAddress);
        address.name = parsed.name || address.name;
        address.address1 = parsed.street || parsed.address1 || "";
        address.city = parsed.city || "";
        address.province = parsed.state || "";
        address.zip = parsed.zip || "";
        address.country = parsed.country || "India";
        address.phone = parsed.phone || "";
      } catch { /* use provided */ }
    }

    const result = await shipOrder(order_id, items, address);

    // Update the shipment with AWB alias
    if (result.trackingNumber) {
      await prisma.shipment.updateMany({
        where: { orderId: order_id, trackingNumber: result.trackingNumber },
        data: { awb: result.trackingNumber },
      });
    }

    return NextResponse.json({
      awb: result.trackingNumber,
      label_url: result.trackingUrl,
      courier: result.courier,
      success: true,
    });
  } catch (error: any) {
    console.error("[Logistics] Create shipment error:", error.message);
    return NextResponse.json(
      { error: "Failed to create shipment. Please try again." },
      { status: 500 }
    );
  }
}
