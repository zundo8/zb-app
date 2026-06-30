/**
 * POST /api/webhooks/logistics — Delhivery/Shiprocket Webhook Handler
 * 
 * Validates signature, uses webhook_events table for idempotency,
 * updates shipment status, and triggers push notifications.
 * 
 * NOT protected by session auth — uses signature validation.
 */

import { NextResponse, NextRequest } from 'next/server';
import * as crypto from 'crypto';
import prisma from '@/lib/db';
import { validateWebhookSignature, resolveWebhookSecret } from '@/lib/services/logistics';

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

interface ShipmentDetail {
  AWB?: string;
  tracking_number?: string;
  awb?: string;
  waybill?: string;
  shipment_id?: string;
  ReferenceNo?: string;
  status?: string;
  current_status?: string;
  shipment_status?: string;
  timestamp?: string;
  event_time?: string;
  scanned_date?: string;
  location?: string;
  current_location?: string;
  city?: string;
  description?: string;
  activity?: string;
  status_description?: string;
  Status?: {
    Status?: string;
    StatusType?: string;
    StatusDateTime?: string;
    PickUpDate?: string;
    StatusLocation?: string;
    Instructions?: string;
  };
  estimated_delivery?: string;
  etd?: string;
}

interface WebhookPayload extends ShipmentDetail {
  Shipment?: ShipmentDetail;
}

/**
 * Logs a webhook event to the webhook_logs table for audit/debugging.
 * Uses raw SQL since the table is not modeled in Prisma.
 * Silently catches errors if the table doesn't exist yet.
 */
async function logToWebhookLogs(
  source: string,
  payload: string,
  status: string
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "webhook_logs" ("id", "source", "payload", "status", "created_at") VALUES ($1, $2, $3, $4, NOW())`,
      crypto.randomUUID(),
      source,
      payload.substring(0, 10000),
      status
    );
  } catch (err) {
    // webhook_logs table may not exist yet — log warning but don't fail the webhook
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Webhook] Could not write to webhook_logs:', errMsg.substring(0, 150));
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('authorization') ||
      req.headers.get('x-webhook-signature') ||
      req.headers.get('x-shiprocket-signature') ||
      req.headers.get('x-delhivery-signature') || '';

    // Validate webhook signature using the unified secret resolver
    const { secret, source } = await resolveWebhookSecret();

    // Parse payload early to assist provider detection
    let earlyPayload: { Shipment?: unknown } | null = null;
    try { earlyPayload = JSON.parse(rawBody) as { Shipment?: unknown }; } catch {}

    // Detect provider: Delhivery sends Bearer token in Authorization header
    const isDelhivery =
      !!req.headers.get('authorization') ||
      !!req.headers.get('x-delhivery-signature') ||
      !!earlyPayload?.Shipment;

    const provider = isDelhivery ? 'delhivery' : 'generic';

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (secret && signature) {
      const isValid = validateWebhookSignature(rawBody, signature, secret, provider);
      if (!isValid) {
        const secretTail = secret ? secret.slice(-4) : '';
        const sigHead = signature ? signature.slice(0, 12) : '';
        console.error(`[Webhook] Signature mismatch. Secret source=${source}, secret tail=****${secretTail}, signature received=${sigHead}...`);
        
        const debugPayload = `Secret source: ${source} | Secret tail: ****${secretTail} | Received signature: ${signature} | IP: ${ip} | RawBody: ${rawBody}`;
        await logToWebhookLogs('delhivery', debugPayload, 'unauthorized_signature_mismatch');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (!signature && secret) {
      // Secret configured but no signature sent — reject
      const secretTail = secret ? secret.slice(-4) : '';
      console.error(`[Webhook] No signature provided from IP ${ip} at ${new Date().toISOString()} but webhook secret is configured. Secret source=${source}, secret tail=****${secretTail}`);
      
      const debugPayload = `Secret source: ${source} | Secret tail: ****${secretTail} | IP: ${ip} | RawBody: ${rawBody}`;
      await logToWebhookLogs('delhivery', debugPayload, 'unauthorized_missing_signature');
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }

    // Parse the payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Handle nested Shipment structure (Delhivery default format)
    let shipmentData: ShipmentDetail = payload;
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

    // FIX 2: Expanded AWB field lookup — check trackingNumber and awb on Shipment,
    // plus delhivery_awb on the related Order, to handle AWBs stored under any column.
    const shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingNumber },
          { awb: trackingNumber },
          { order: { delhivery_awb: trackingNumber } },
        ],
      },
      include: { order: { include: { customer: true } } },
    });

    // FIX 1: Graceful handling for unknown AWBs — return 200 instead of 404
    if (!shipment) {
      console.warn(`[Webhook] No shipment found for AWB: ${trackingNumber} — skipping gracefully`);
      // Mark event as processed to avoid retries
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });
      // Log to webhook_logs with skipped status
      await logToWebhookLogs('delhivery', rawBody, 'skipped_unknown_awb');
      return NextResponse.json({ success: true, message: 'AWB not tracked' }, { status: 200 });
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
    const updateData: {
      status: string;
      currentLocation: string;
      events: string;
      estimatedDelivery?: Date;
    } = {
      status: normalizedStatus,
      currentLocation: location || shipment.currentLocation || '',
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

    // Log successful processing to webhook_logs
    await logToWebhookLogs('delhivery', rawBody, 'processed');

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
  } catch (error) {
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
