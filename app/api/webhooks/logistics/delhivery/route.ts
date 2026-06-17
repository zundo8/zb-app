import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.DELHIVERY_WEBHOOK_SECRET;

    if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    console.log('[Delhivery Webhook] Received:', payload);

    let waybill = payload.waybill;
    let status = payload.status;
    let remark = payload.remark;
    let location = payload.location;

    // Handle nested Shipment structure (Delhivery default format)
    if (payload.Shipment) {
      const s = payload.Shipment;
      waybill = s.AWB || s.tracking_number || s.ReferenceNo;
      if (s.Status) {
        status = s.Status.StatusType || s.Status.Status;
        remark = s.Status.Instructions || s.Status.remark;
        location = s.Status.StatusLocation || s.Status.location;
      }
    }

    if (!waybill) {
      return NextResponse.json({ success: false, error: 'Waybill missing' }, { status: 400 });
    }

    // Map Delhivery status codes to internal status
    let deliveryStatus = 'pending';
    switch (status) {
      case 'DL':
        deliveryStatus = 'delivered';
        break;
      case 'UD':
        deliveryStatus = 'in_transit';
        break;
      case 'RT':
        deliveryStatus = 'rto';
        break;
      case 'CN':
        deliveryStatus = 'cancelled';
        break;
      default:
        if (remark?.toLowerCase().includes('out for delivery')) deliveryStatus = 'out_for_delivery';
        else if (remark?.toLowerCase().includes('manifested')) deliveryStatus = 'manifested';
        else deliveryStatus = 'in_transit';
    }

    // Find shipment and update
    const shipment = await prisma.shipment.findUnique({
      where: { awb: waybill }
    });

    if (shipment) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: deliveryStatus,
          lastLocation: payload.location || null,
          updatedAt: new Date()
        }
      });

      // Also update the parent order's delivery status
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { deliveryStatus }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Delhivery Webhook] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
