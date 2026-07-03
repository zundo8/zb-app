import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/exchanges/[id]
 * Fetch a single exchange request with full details including linked return and customer info
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id: params.id },
      include: {
        exchanges: {
          include: {
            originalProduct: true,
            newProduct: true,
          }
        },
        order: {
          include: {
            items: true,
            customer: true,
            shipments: true,
          }
        },
      },
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: 'Exchange request not found' }, { status: 404 });
    }

    // Fetch the linked return request if it exists
    let linkedReturn = null;
    if (exchangeRequest.returnRequestId) {
      linkedReturn = await prisma.returnRequest.findUnique({
        where: { id: exchangeRequest.returnRequestId },
        include: {
          returns: { include: { product: true } },
        }
      });
    }

    return NextResponse.json({
      exchangeRequest: {
        ...exchangeRequest,
        linkedReturn,
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('Exchange Detail API Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch exchange' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/exchanges/[id]
 * Update exchange status with full workflow:
 *   pending_approval → approved → received → qc_passed → new_order_created → shipped → completed
 *   pending_approval → rejected
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { status, trackingNumber, qcNotes, qcStatus } = body;
    const exchangeId = params.id;

    const validStatuses = ['approved', 'rejected', 'return_created', 'received', 'qc_passed', 'new_order_created', 'shipped', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const exchangeRequest = await prisma.exchangeRequest.findUnique({
      where: { id: exchangeId },
      include: {
        exchanges: true,
      },
    });

    if (!exchangeRequest) {
      return NextResponse.json({ error: 'Exchange request not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = { status };

    const updatedRequest = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.exchangeRequest.update({
        where: { id: exchangeId },
        data: updateData,
        include: {
          exchanges: { include: { originalProduct: true, newProduct: true } },
          order: { include: { customer: true } },
        },
      });

      // Update individual exchange items
      const exchangeItemStatus = status.toUpperCase();
      const exchangeUpdateData: any = { status: exchangeItemStatus };
      
      if (qcStatus) exchangeUpdateData.qcStatus = qcStatus;
      if (qcNotes) exchangeUpdateData.qcNotes = qcNotes;

      await tx.exchange.updateMany({
        where: { exchangeRequestId: exchangeId },
        data: exchangeUpdateData,
      });

      // Handle shipped status — create shipment record
      if (status === 'shipped' && trackingNumber) {
        const orderToShip = exchangeRequest.exchanges[0]?.newOrderId;
        if (orderToShip) {
          try {
            await tx.shipment.create({
              data: {
                orderId: orderToShip,
                trackingNumber,
                courier: 'Exchange Shipment',
                status: 'shipped',
              },
            });
          } catch (shipErr: any) {
            console.error('⚠️ Shipment creation failed:', shipErr.message);
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ success: true, exchangeRequest: updatedRequest }, { status: 200 });
  } catch (error: any) {
    console.error('Admin Exchange API Error:', error);
    return NextResponse.json({ error: 'Failed to update exchange request' }, { status: 500 });
  }
}
