import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * PATCH /api/admin/returns/update-size
 * Updates size for a Return item.
 * Payload: { returnId: string, size: string, variantTitle?: string }
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { returnId, size, variantTitle } = body;

    if (!returnId || !size) {
      return NextResponse.json({ error: "Missing required fields: returnId, size" }, { status: 400 });
    }

    const cleanSize = size.trim().toUpperCase();
    const cleanVariant = variantTitle?.trim() || `Size: ${cleanSize}`;

    const ret = await prisma.return.findUnique({
      where: { id: returnId },
      include: { order: { include: { items: true } } }
    });

    if (!ret) {
      return NextResponse.json({ error: "Return item not found" }, { status: 404 });
    }

    const updatedReturn = await prisma.return.update({
      where: { id: returnId },
      data: {
        size: cleanSize,
        variantTitle: cleanVariant,
      },
    });

    // Also update matching OrderItem size
    if (ret.order?.items) {
      const matchingItem = ret.order.items.find(
        (i: any) => i.productId === ret.productId || (ret.sku && i.sku === ret.sku)
      );
      if (matchingItem) {
        await prisma.orderItem.update({
          where: { id: matchingItem.id },
          data: {
            size: cleanSize,
            variantTitle: cleanVariant,
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      return: updatedReturn
    });
  } catch (error: any) {
    console.error("Update Return Size Error:", error.message);
    return NextResponse.json({ error: "Failed to update return size" }, { status: 500 });
  }
}
