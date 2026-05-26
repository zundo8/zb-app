import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { cancelShipment } from '@/lib/delhivery/api';

export async function POST(req: Request) {
  try {
    const { awb } = await req.json();
    if (!awb) {
      return NextResponse.json({ error: 'AWB is required' }, { status: 400 });
    }

    const result = await cancelShipment(awb);

    if (result.success) {
      const order = await prisma.order.findFirst({
        where: { delhivery_awb: awb }
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            delhivery_awb: null,
            status: 'Processing',
            deliveryStatus: 'pending'
          }
        });

        await prisma.shipment.updateMany({
          where: { orderId: order.id, awb },
          data: { status: 'cancelled' }
        });
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Failed to cancel shipment' }, { status: 500 });
    }
  } catch (err: any) {
    console.error('[Cancel Shipment API] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
