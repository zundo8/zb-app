import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Fetch all shipments with their orders
    const shipmentWhere: any = {};
    if (status) {
      shipmentWhere.status = status;
    }
    if (search) {
      shipmentWhere.OR = [
        { awb: { contains: search, mode: 'insensitive' } },
        { order: { shopifyOrderId: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const shipments = await prisma.shipment.findMany({
      where: shipmentWhere,
      include: {
        order: {
          select: {
            shopifyOrderId: true,
            fulfillmentStatus: true,
            customer: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch orders that are "fulfilled" but might not have a Shipment record yet in our system
    // (This happens for Shopify orders synced after fulfillment)
    const ordersNeedingShipmentRecord = await prisma.order.findMany({
      where: {
        fulfillmentStatus: 'fulfilled',
        shipments: { none: {} },
        shopifyOrderId: search ? { contains: search, mode: 'insensitive' } : undefined
      },
      include: {
        customer: { select: { name: true } }
      },
      take: 20
    });

    // Merge them into a unified list for the UI
    const unifiedShipments = [
      ...shipments,
      ...ordersNeedingShipmentRecord.map(o => ({
        id: `pending-${o.id}`,
        orderId: o.id,
        awb: null,
        courier: 'Pending',
        status: 'manifest_required',
        trackingUrl: null,
        createdAt: o.createdAt,
        order: {
          shopifyOrderId: o.shopifyOrderId,
          customer: o.customer
        }
      }))
    ];

    return NextResponse.json({ success: true, shipments: unifiedShipments });
  } catch (error: any) {
    console.error('[Logistics API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
