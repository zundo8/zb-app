import prisma from '../db';
import { sendTrackingPushNotification } from './notifications';

function mapReverseStatus(rawStatus: string): string {
  const s = (rawStatus || '').trim().toLowerCase();
  if (s.includes('manifested') || s.includes('scheduled') || s.includes('pending')) {
    return 'pickup_pending';
  }
  if (s.includes('transit') || s.includes('dispatched') || s.includes('picked')) {
    return 'in_transit';
  }
  if (s.includes('dto delivered') || s.includes('delivered-at-origin') || s.includes('delivered') || s === 'dl') {
    return 'received';
  }
  if (s.includes('failed') || s.includes('cancelled')) {
    return 'pickup_registration_failed';
  }
  return 'in_transit';
}

export async function updateOrderTracking({
  awb,
  shopifyOrderId,
  status,
  statusDateTime,
  statusType,
  location,
  instructions
}: {
  awb: string;
  shopifyOrderId: string;
  status: string;
  statusDateTime: string;
  statusType: string;
  location: string;
  instructions: string;
}) {
  if (!awb && !shopifyOrderId) {
    console.warn('[Delhivery Tracking] Missing both AWB and order reference.');
    return;
  }

  // Idempotency check using WebhookEvent table
  const eventKey = `${awb}_${status}_${statusDateTime}`;
  const existingEvent = await prisma.webhookEvent.findFirst({
    where: {
      source: 'delhivery',
      payload: { contains: eventKey }
    }
  });

  if (existingEvent?.processed) {
    console.log(`[Delhivery Tracking] Event already processed: ${eventKey}`);
    return;
  }

  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      source: 'delhivery',
      eventType: status,
      payload: JSON.stringify({ awb, shopifyOrderId, status, statusDateTime, location, instructions, eventKey }),
      processed: false
    }
  });

  try {
    // 1. Resolve target Shipment BY AWB FIRST
    let shipment = await prisma.shipment.findFirst({
      where: {
        OR: [
          { awb },
          { trackingNumber: awb }
        ]
      },
      include: { order: true }
    });

    // 2. Fallback to ReferenceNo -> Order if no AWB match exists
    let order = shipment?.order;
    if (!order && shopifyOrderId) {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { shopifyOrderId },
            { id: shopifyOrderId }
          ]
        }
      });
    }

    if (!shipment && !order) {
      console.warn(`[Delhivery Tracking] Neither shipment nor order found for AWB: ${awb}, ReferenceNo: ${shopifyOrderId}`);
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() }
      });
      return;
    }

    // Prepare events scan history
    let events: any[] = [];
    if (shipment && shipment.events) {
      try {
        events = JSON.parse(shipment.events);
      } catch (e) {
        events = [];
      }
    }

    const isDuplicate = events.some(
      (e: any) => e.timestamp === statusDateTime && e.status === status
    );

    if (!isDuplicate) {
      events.push({
        status,
        location,
        timestamp: statusDateTime,
        description: instructions || statusType || status
      });
    }

    // Upsert shipment record if target order exists
    if (!shipment && order) {
      shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          awb,
          trackingNumber: awb,
          courier: 'Delhivery',
          status,
          type: 'outbound',
          currentLocation: location,
          trackingUrl: `https://www.delhivery.com/track/package/${awb}`,
          events: JSON.stringify(events)
        },
        include: { order: true }
      });
    } else if (shipment) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status,
          currentLocation: location,
          updatedAt: new Date(),
          events: JSON.stringify(events)
        }
      });
    }

    // 3. Handle routing based on shipment type
    const isReverse = shipment?.type === 'reverse_pickup';

    if (isReverse) {
      const mappedReverseStatus = mapReverseStatus(status);
      const targetOrderId = shipment?.orderId || order?.id;

      // Update linked ExchangeRequest if exists
      const exchangeReq = await prisma.exchangeRequest.findFirst({
        where: {
          OR: [
            { reverseAwb: awb },
            ...(targetOrderId ? [{ orderId: targetOrderId }] : [])
          ]
        }
      });

      if (exchangeReq && exchangeReq.status !== 'cancelled') {
        const currentIdx = ['pending_approval', 'approved_pickup_failed', 'approved', 'in_transit', 'received', 'qc_passed', 'new_order_created', 'shipped', 'completed'].indexOf(exchangeReq.status);
        const mappedIdx = ['pending_approval', 'approved_pickup_failed', 'approved', 'in_transit', 'received'].indexOf(mappedReverseStatus);

        // Advance status if forward movement detected and not yet past received
        if (mappedIdx > currentIdx && currentIdx < 4) {
          await prisma.exchangeRequest.update({
            where: { id: exchangeReq.id },
            data: { status: mappedReverseStatus }
          });
        }
      }

      // Update linked ReturnRequest if exists
      const returnReq = await prisma.returnRequest.findFirst({
        where: {
          OR: [
            { reverseAwb: awb },
            ...(targetOrderId ? [{ orderId: targetOrderId }] : [])
          ]
        }
      });

      if (returnReq && returnReq.status !== 'cancelled') {
        if (mappedReverseStatus === 'in_transit' && returnReq.status === 'approved') {
          await prisma.returnRequest.update({
            where: { id: returnReq.id },
            data: { status: 'in_transit' }
          });
        } else if (mappedReverseStatus === 'received' && ['approved', 'in_transit'].includes(returnReq.status)) {
          await prisma.returnRequest.update({
            where: { id: returnReq.id },
            data: { status: 'received' }
          });
        }
      }

      // Reverse pickup updates request/shipment, NOT the customer's original Order.deliveryStatus
      console.log(`[Delhivery Tracking] Reverse pickup updated for AWB ${awb} → ${mappedReverseStatus}`);

    } else if (order || shipment?.orderId) {
      // Outbound shipment update
      const activeOrderId = order?.id || shipment?.orderId;
      if (activeOrderId) {
        await prisma.order.update({
          where: { id: activeOrderId },
          data: {
            tracking_status: status,
            deliveryStatus: status.toLowerCase()
          }
        });

        // If outbound shipment is tied to an exchange replacement order, update exchange request tracking
        const linkedExchange = await prisma.exchangeRequest.findFirst({
          where: {
            OR: [
              { newShopifyOrderId: order?.shopifyOrderId || '' },
              { orderId: activeOrderId }
            ]
          }
        });

        if (linkedExchange) {
          const lowerStatus = status.toLowerCase();
          if (lowerStatus.includes('delivered') && linkedExchange.status === 'shipped') {
            await prisma.exchangeRequest.update({
              where: { id: linkedExchange.id },
              data: { status: 'completed' }
            });
          } else if ((lowerStatus.includes('dispatched') || lowerStatus.includes('transit')) && linkedExchange.status === 'new_order_created') {
            await prisma.exchangeRequest.update({
              where: { id: linkedExchange.id },
              data: { status: 'shipped' }
            });
          }
        }
      }
    }

    // Mark event processed
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() }
    });

    // Trigger push notification flow
    await sendTrackingPushNotification(awb, status);
  } catch (err: any) {
    console.error('[Delhivery Tracking Error]', err);
  }
}

