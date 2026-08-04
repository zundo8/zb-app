import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * PATCH /api/admin/orders/update-size
 * Updates size for an OrderItem.
 * Payload: { orderItemId: string, size: string, variantTitle?: string }
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { orderItemId, size, variantTitle } = body;

    if (!orderItemId || !size) {
      return NextResponse.json({ error: "Missing required fields: orderItemId, size" }, { status: 400 });
    }

    const cleanSize = size.trim().toUpperCase();
    const cleanVariant = variantTitle?.trim() || `Size: ${cleanSize}`;

    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId }
    });

    if (!orderItem) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        size: cleanSize,
        variantTitle: cleanVariant,
      },
    });

    return NextResponse.json({
      success: true,
      orderItem: updatedItem
    });
  } catch (error: any) {
    console.error("Update Order Item Size Error:", error.message);
    return NextResponse.json({ error: "Failed to update order item size" }, { status: 500 });
  }
}
