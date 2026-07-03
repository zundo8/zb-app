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

    // Also fetch orders that need shipment — fulfilled without a Shipment record,
    // OR unfulfilled but paid/active orders ready to be manifested
    const orderWhereConditions: any[] = [
      { shipments: { none: {} } },
      { status: { notIn: ['cancelled', 'CANCELLED', 'FAILED', 'payment_failed', 'REFUNDED'] } },
      {
        OR: [
          { fulfillmentStatus: 'fulfilled' },
          {
            fulfillmentStatus: 'unfulfilled',
            status: { in: ['active', 'PAID', 'confirmed', 'open'] },
          },
        ],
      },
    ];

    if (search) {
      orderWhereConditions.push({
        OR: [
          { shopifyOrderId: { contains: search, mode: 'insensitive' as const } },
          { shopifyOrderName: { contains: search, mode: 'insensitive' as const } },
          { delhivery_awb: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }

    const ordersNeedingShipmentRecord = await prisma.order.findMany({
      where: { AND: orderWhereConditions },
      include: {
        customer: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Merge them into a unified list for the UI
    const unifiedShipments = [
      ...shipments,
      ...ordersNeedingShipmentRecord
        .filter((o: any) => !shipments.some((s: any) => s.orderId === o.id)) // avoid duplicates
        .map((o: any) => ({
          id: `pending-${o.id}`,
          orderId: o.id,
          awb: o.delhivery_awb || null,
          courier: o.delhivery_awb ? 'Delhivery' : 'Pending',
          status: o.delhivery_awb ? 'manifested' : 'manifest_required',
          trackingUrl: o.delhivery_awb ? `https://www.delhivery.com/track/package/${o.delhivery_awb}` : null,
          createdAt: o.createdAt,
          order: {
            shopifyOrderId: o.shopifyOrderName || o.shopifyOrderId || '',
            fulfillmentStatus: o.fulfillmentStatus,
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
