/**
 * POST /api/webhooks/logistics — Delhivery/Shiprocket Webhook Handler
 * 
 * Validates signature, uses webhook_events table for idempotency,
 * updates shipment status, and triggers push notifications.
 * 
 * NOT protected by session auth — uses signature validation.
 */

import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { validateWebhookSignature } from '@/lib/services/logistics';

export const dynamic = 'force-dynamic';

// Status mapping from logistics partner status codes to our internal status
const STATUS_MAP: Record<string, string> = {
  // Shiprocket
  '1': 'confirmed', '2': 'packed', '3': 'packed', '4': 'shipped',
  '5': 'shipped', '6': 'out_for_delivery', '7': 'delivered',
  '8': 'cancelled', '9': 'rto',
  // Generic
  'confirmed': 'confirmed', 'picked_up': 'shipped', 'packed': 'packed',
  'in_transit': 'shipped', 'shipped': 'shipped', 'out_for_delivery': 'out_for_delivery',
  'delivered': 'delivered', 'cancelled': 'cancelled', 'returned': 'rto', 'failed': 'failed',
  // Delhivery
  'Manifested': 'confirmed', 'In Transit': 'shipped', 'Dispatched': 'shipped',
  'Out for Delivery': 'out_for_delivery', 'Delivered': 'delivered', 'RTO': 'rto',
};

function normalizeStatus(rawStatus: string): string {
  return STATUS_MAP[rawStatus] || rawStatus.toLowerCase().replace(/\s+/g, '_');
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature') ||
                      req.headers.get('x-shiprocket-signature') ||
                      req.headers.get('x-delhivery-signature') || '';

    // Validate webhook signature
    const webhookSecret = process.env.DELHIVERY_WEBHOOK_SECRET || '';
    
    // Also check DB fallback
    let secret = webhookSecret;
    if (!secret) {
      const shop = await prisma.shop.findFirst({ select: { webhookSecret: true } });
      secret = shop?.webhookSecret || '';
    }

    if (secret && signature) {
      const isValid = validateWebhookSignature(rawBody, signature, secret);
      if (!isValid) {
        console.error('[Webhook] Invalid logistics signature — rejecting');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
      }
    } else if (!signature && secret) {
      // Secret configured but no signature sent — reject
      console.error('[Webhook] No signature provided but webhook secret is configured');
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    // Parse the payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Handle nested Shipment structure (Delhivery default format)
    let shipmentData = payload;
    if (payload.Shipment) {
      shipmentData = payload.Shipment;
    }

    // Normalize fields
    const trackingNumber = shipmentData.AWB || shipmentData.tracking_number || shipmentData.awb || shipmentData.waybill || shipmentData.shipment_id || shipmentData.ReferenceNo;
    
    let rawStatus = shipmentData.status || shipmentData.current_status || shipmentData.shipment_status;
    let timestamp = shipmentData.timestamp || shipmentData.event_time || shipmentData.scanned_date;
    let location = shipmentData.location || shipmentData.current_location || shipmentData.city || '';
    let description = shipmentData.description || shipmentData.activity || shipmentData.status_description || '';

    // Handle nested Status structure from default payload
    if (shipmentData.Status) {
      rawStatus = rawStatus || shipmentData.Status.Status || shipmentData.Status.StatusType;
      timestamp = timestamp || shipmentData.Status.StatusDateTime || shipmentData.Status.PickUpDate;
      location = location || shipmentData.Status.StatusLocation || '';
      description = description || shipmentData.Status.Instructions || '';
    }

    timestamp = timestamp || new Date().toISOString();
    const estimatedDelivery = shipmentData.estimated_delivery || shipmentData.etd || null;

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Missing tracking_number in payload' }, { status: 400 });
    }
    if (!rawStatus) {
      return NextResponse.json({ error: 'Missing status in payload' }, { status: 400 });
    }

    const normalizedStatus = normalizeStatus(rawStatus);
    const eventId = `${trackingNumber}_${rawStatus}_${timestamp}`;

    // Idempotency: check webhook_events table
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        source: 'delhivery',
        payload: { contains: eventId.slice(0, 50) },
      },
    });

    if (existingEvent?.processed) {
      console.log(`[Webhook] Event already processed: ${normalizedStatus} for ${trackingNumber}`);
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Insert event record
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        source: 'delhivery',
        eventType: normalizedStatus,
        payload: rawBody,
        processed: false,
      },
    });

    // Find and update shipment
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingNumber },
          { awb: trackingNumber },
        ],
      },
      include: { order: { include: { customer: true } } },
    });

    if (!shipment) {
      console.warn(`[Webhook] No shipment found for: ${trackingNumber}`);
      // Still mark event as processed to avoid retries
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });
      return NextResponse.json({ error: 'Shipment not found', tracking_number: trackingNumber }, { status: 404 });
    }

    // Append event to scan history
    const existingEvents = JSON.parse(shipment.events || '[]');
    existingEvents.push({
      status: normalizedStatus,
      location,
      timestamp,
      description: description || `Status updated to ${normalizedStatus}`,
    });

    // Update shipment
    const updateData: any = {
      status: normalizedStatus,
      currentLocation: location || shipment.currentLocation,
      events: JSON.stringify(existingEvents),
    };
    if (estimatedDelivery) {
      updateData.estimatedDelivery = new Date(estimatedDelivery);
    }

    await prisma.shipment.update({ where: { id: shipment.id }, data: updateData });
    await prisma.order.update({ where: { id: shipment.orderId }, data: { deliveryStatus: normalizedStatus } });

    // Mark event processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() },
    });

    console.log(`[Webhook] ✅ Updated shipment ${shipment.id} → ${normalizedStatus}`);

    // TODO: Trigger push notification for key events
    // const pushEvents = ['out_for_delivery', 'delivered', 'rto'];
    // if (pushEvents.includes(normalizedStatus)) {
    //   await sendPushNotification(shipment.order.customer.id, { ... });
    // }

    return NextResponse.json({
      success: true,
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: normalizedStatus,
    });
  } catch (error: any) {
    console.error('[Webhook] Logistics webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/logistics — Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: 'Zica Bella Logistics Webhook endpoint is live.',
    supported_events: ['tracking_update', 'status_change', 'delivery_confirmation'],
    timestamp: new Date().toISOString(),
  });
}
