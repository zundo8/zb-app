/**
 * Admin Logistics API
 * 
 * GET  /api/admin/logistics              — Test connection & get provider info
 * POST /api/admin/logistics              — Ship an order
 * GET  /api/admin/logistics?track=<num>  — Get tracking status
 * POST /api/admin/logistics (action=cancel) — Cancel a shipment
 */

import { NextResponse, NextRequest } from 'next/server';
import {
  shipOrder,
  getTrackingStatus,
  cancelShipment,
  testConnection,
  createReturnShipment,
  PROVIDER_PRESETS,
} from '@/lib/services/logistics';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const trackingNumber = url.searchParams.get('track');
  const action = url.searchParams.get('action');

  // Test connection
  if (action === 'test') {
    const result = await testConnection();
    return NextResponse.json(result);
  }

  // Get provider presets
  if (action === 'presets') {
    return NextResponse.json({ presets: PROVIDER_PRESETS });
  }

  // Track a shipment
  if (trackingNumber) {
    const status = await getTrackingStatus(trackingNumber);
    return NextResponse.json({ tracking: status });
  }

  // Default: return current logistics config summary + webhook URL
  try {
    const shop = await prisma.shop.findFirst({
      select: {
        shiprocketToken: true,
        shiprocketEmail: true,
        delhiveryApiKey: true,
        webhookSecret: true,
        domain: true,
      },
    });

    const activeProvider = shop?.shiprocketToken ? 'shiprocket' : shop?.delhiveryApiKey ? 'delhivery' : 'none';
    const baseUrl = activeProvider !== 'none' ? PROVIDER_PRESETS[activeProvider]?.baseUrl : '';

    // Build webhook URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'localhost:3001';
    const webhookUrl = `${protocol}://${host}/api/webhooks/logistics`;

    // Get recent shipments
    const recentShipments = await prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { order: { select: { shopifyOrderId: true } } },
    });

    return NextResponse.json({
      activeProvider,
      baseUrl,
      webhookUrl,
      webhookSecret: shop?.webhookSecret ? '••••••••' + (shop.webhookSecret.slice(-4)) : 'Not configured',
      recentShipments: recentShipments.map((s: any) => ({
        id: s.id,
        orderId: s.order.shopifyOrderId,
        trackingNumber: s.trackingNumber,
        courier: s.courier,
        status: s.status,
        currentLocation: s.currentLocation,
        estimatedDelivery: s.estimatedDelivery,
        trackingUrl: s.trackingUrl,
        createdAt: s.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[Logistics API] GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch logistics info' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Ship an order
    if (action === 'ship') {
      const { orderId, items, address } = body;
      if (!orderId) {
        return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
      }
      const result = await shipOrder(orderId, items || [], address || {});
      return NextResponse.json({ success: true, shipment: result });
    }

    // Cancel a shipment
    if (action === 'cancel') {
      const { trackingNumber } = body;
      if (!trackingNumber) {
        return NextResponse.json({ error: 'trackingNumber is required' }, { status: 400 });
      }
      const result = await cancelShipment(trackingNumber);
      return NextResponse.json(result);
    }

    // Create return shipment
    if (action === 'return') {
      const { returnId, pickupAddress } = body;
      if (!returnId || !pickupAddress) {
        return NextResponse.json({ error: 'returnId and pickupAddress are required' }, { status: 400 });
      }
      const result = await createReturnShipment(returnId, pickupAddress);
      return NextResponse.json({ success: true, shipment: result });
    }

    return NextResponse.json({ error: 'Invalid action. Use: ship, cancel, or return' }, { status: 400 });
  } catch (error: any) {
    console.error('[Logistics API] POST Error:', error.message);
    return NextResponse.json({ error: `Operation failed: ${error.message}` }, { status: 500 });
  }
}
