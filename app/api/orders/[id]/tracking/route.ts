import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { getAppAuthFromRequest } from '@/lib/appAuth';
import { trackShipment } from '@/lib/delhivery/api';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'max-age=60',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id: orderId } = params;
    const url = new URL(req.url);
    const qCustomerId = url.searchParams.get('customerId');
    const qPhone = url.searchParams.get('phone');
    const qEmail = url.searchParams.get('email');

    // 1. Next-Auth Session (Web clients)
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user ? (session.user as any).id : null;
    const sessionEmail = session?.user?.email;

    // 2. Bearer Token JWT (React Native app clients)
    const auth = getAppAuthFromRequest(req);
    const authCustomerId = auth?.customerId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: corsHeaders });
    }

    // 3. Authorization Check
    let isAuthorized = false;
    if (sessionUserId && order.customerId === sessionUserId) {
      isAuthorized = true;
    } else if (sessionEmail && order.customer?.email === sessionEmail) {
      isAuthorized = true;
    } else if (authCustomerId && order.customerId === authCustomerId) {
      isAuthorized = true;
    } else if (order.customer) {
      // Check query parameters for guest tracking
      if (qCustomerId === order.customerId) isAuthorized = true;
      if (qEmail && order.customer.email === qEmail) isAuthorized = true;
      if (qPhone) {
        const orderPhone = order.customer.phone?.replace(/\D/g, '').slice(-10);
        const inputPhone = qPhone.replace(/\D/g, '').slice(-10);
        if (orderPhone && inputPhone && orderPhone === inputPhone) isAuthorized = true;
      }
    } else if (qCustomerId === order.customerId) {
      isAuthorized = true;
    }

    if (!isAuthorized && !auth) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401, headers: corsHeaders });
    }
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized access to order' }, { status: 403, headers: corsHeaders });
    }

    // If no AWB exists: return empty structure
    if (!order.delhivery_awb) {
      return NextResponse.json({
        awb: null,
        currentStatus: null,
        statusDateTime: null,
        location: null,
        timeline: []
      }, { headers: corsHeaders });
    }

    // Fetch live tracking logs from Delhivery
    const trackingData = await trackShipment(order.delhivery_awb);
    if (!trackingData || !trackingData.ShipmentData || trackingData.ShipmentData.length === 0) {
      // Return empty tracking timeline if Delhivery has no records yet
      return NextResponse.json({
        awb: order.delhivery_awb,
        currentStatus: order.tracking_status || 'Manifested',
        statusDateTime: order.createdAt.toISOString(),
        location: 'Warehouse',
        timeline: []
      }, { headers: corsHeaders });
    }

    const pkg = trackingData.ShipmentData[0].Shipment;
    const currentStatus = pkg.Status?.Status || 'Manifested';
    const statusDateTime = pkg.Status?.StatusDateTime || '';
    const location = pkg.Status?.StatusLocation || '';

    const timeline = (pkg.Scans || []).map((scan: any) => ({
      status: scan.ScanDetail?.Scan || '',
      dateTime: scan.ScanDetail?.ScanDateTime || '',
      location: scan.ScanDetail?.ScannedLocation || '',
      instructions: scan.ScanDetail?.Instructions || ''
    }));

    // Sort timeline newest first
    timeline.sort((a: any, b: any) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    return NextResponse.json({
      awb: order.delhivery_awb,
      currentStatus,
      statusDateTime,
      location,
      timeline
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('[App Order Tracking API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
}
