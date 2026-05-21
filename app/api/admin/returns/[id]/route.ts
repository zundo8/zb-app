import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createRefund } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/returns/[id]
 * Update return request status with full workflow support:
 *   REQUESTED → APPROVED → RECEIVED → REFUNDED
 *   REQUESTED → REJECTED
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { status, refundAmount, refundMethod } = body;
    const returnRequestId = params.id;

    const validStatuses = ['APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED', 'PICKUP_SCHEDULED', 'REFUND_PENDING'];
    const lowerStatus = status.toLowerCase(); // keep request level status lowercase
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        returns: { include: { product: true } },
        order: { include: { items: true, shop: true } },
      },
    });

    if (!returnRequest) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    const updateData: any = { status: lowerStatus };
    const returnItemUpdateData: any = { status: status.toUpperCase() };

    if (lowerStatus === 'refunded') {
      updateData.actualRefund = refundAmount || returnRequest.estimatedRefund;
      returnItemUpdateData.refundStatus = 'COMPLETED';
      returnItemUpdateData.refundAmount = refundAmount || returnRequest.estimatedRefund;
    }

    const updatedReturnRequest = await prisma.$transaction(async (tx) => {
      // 1. Update the ReturnRequest
      const reqUpdate = await tx.returnRequest.update({
        where: { id: returnRequestId },
        data: updateData,
        include: { returns: true }
      });

      // 2. Update individual Return items
      await tx.return.updateMany({
        where: { returnRequestId },
        data: returnItemUpdateData
      });

      return reqUpdate;
    });

    // When marked REFUNDED, create a Shopify refund for the relevant line items
    if (lowerStatus === 'refunded') {
      try {
        const orderId = returnRequest.order.shopifyOrderId;
        const refundLineItems: any[] = [];
        
        for (const item of returnRequest.returns) {
           const matchingLineItem = returnRequest.order.items.find(
             (oi) => oi.sku === item.sku || oi.productId === item.productId
           );
           
           if (matchingLineItem?.shopifyLineItemId) {
              refundLineItems.push({
                line_item_id: parseInt(matchingLineItem.shopifyLineItemId, 10),
                quantity: item.quantity || 1,
                restock_type: 'return',
              });
           }
        }

        if (refundLineItems.length > 0) {
          await createRefund(
            orderId,
            refundLineItems,
            `Return completed: ${returnRequest.reason}`
          );
          console.log(`✅ Shopify refund created for order ${orderId}`);
        }
      } catch (refundError: any) {
        console.error('⚠️ Shopify Refund Error:', refundError.message);
        // We log but don't fail the request since local DB is updated
      }
    }

    return NextResponse.json({ success: true, returnRequest: updatedReturnRequest }, { status: 200 });
  } catch (error: any) {
    console.error('Admin Return API Error:', error);
    return NextResponse.json({ error: 'Failed to update return request' }, { status: 500 });
  }
}

/**
 * GET /api/admin/returns/[id]
 * Fetch a single return request with full details
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: params.id },
      include: {
        returns: {
          include: { product: true }
        },
        order: { include: { items: true, customer: true } },
      },
    });

    if (!returnRequest) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    return NextResponse.json({ return: returnRequest }, { status: 200 });
  } catch (error: any) {
    console.error('Return Detail API Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch return' }, { status: 500 });
  }
}
