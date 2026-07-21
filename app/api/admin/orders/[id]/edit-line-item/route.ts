import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSuperAdmin();
    const adminUserId = (session.user as any)?.id || "SUPER_ADMIN";
    const orderId = params.id;

    const body = await req.json();
    const {
      lineItemId,
      newProductId,
      newVariantId,
      newTitle,
      newSku,
      newSize,
      newImage
    } = body;

    if (!lineItemId || !newProductId) {
      return NextResponse.json({ error: "Missing lineItemId or newProductId" }, { status: 400 });
    }

    // 1. Fetch local Order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Locate line item to edit
    const existingItem = order.items.find((item: any) => item.id === lineItemId || item.shopifyLineItemId === lineItemId);

    let oldData: any = {};
    let newData: any = {};

    if (existingItem) {
      oldData = {
        productId: existingItem.productId,
        sku: existingItem.sku,
        title: existingItem.title,
        price: existingItem.price
      };

      // Resolve new Product in local DB if available
      let dbProductId: string | null = null;
      if (newProductId) {
        const cleanId = String(newProductId);
        const byShopifyId = await prisma.product.findUnique({ where: { shopifyProductId: cleanId } });
        if (byShopifyId) dbProductId = byShopifyId.id;
        else {
          const byCuid = await prisma.product.findUnique({ where: { id: cleanId } });
          if (byCuid) dbProductId = byCuid.id;
        }
      }

      const updatedItem = await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: {
          productId: dbProductId,
          sku: newSku || newVariantId || existingItem.sku,
          title: newTitle || existingItem.title,
          image: newImage || existingItem.image,
          // Price is preserved (held constant as originally paid)
        }
      });

      newData = {
        productId: updatedItem.productId,
        sku: updatedItem.sku,
        title: updatedItem.title,
        price: updatedItem.price
      };
    }

    // 3. Update WebStoreOrder items JSON array if corresponding WebStoreOrder exists
    const webStoreOrder = await prisma.webStoreOrder.findFirst({
      where: {
        OR: [
          ...(order.razorpayOrderId ? [{ razorpayOrderId: order.razorpayOrderId }] : []),
          ...(order.internalOrderNumber ? [{ orderNumber: order.internalOrderNumber }] : [])
        ]
      }
    });

    if (webStoreOrder && Array.isArray(webStoreOrder.items)) {
      const itemsArray = webStoreOrder.items as any[];
      const updatedItems = itemsArray.map((item: any) => {
        if (item.product_id === existingItem?.productId || item.variant_id === existingItem?.sku || item.title === existingItem?.title) {
          return {
            ...item,
            product_id: newProductId || item.product_id,
            variant_id: newVariantId || item.variant_id,
            title: newTitle || item.title,
            size: newSize || item.size,
            image_url: newImage || item.image_url,
          };
        }
        return item;
      });

      await prisma.webStoreOrder.update({
        where: { id: webStoreOrder.id },
        data: { items: updatedItems }
      });
    }

    // 4. Log correction to AuditLog
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: "ORDER_LINE_ITEM_CORRECTED",
        module: "ORDERS",
        targetId: orderId,
        metadata: {
          lineItemId,
          oldData,
          newData,
          correctedBy: session?.user?.email || session?.user?.name || "Super Admin",
          timestamp: new Date().toISOString()
        }
      }
    });

    console.log(`[Super Admin] Corrected line item ${lineItemId} on order ${orderId} by ${session?.user?.email || "Super Admin"}`);

    return NextResponse.json({
      success: true,
      message: "Line item updated locally. Click 'Sync to Shopify' to update Shopify order.",
      oldData,
      newData
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
