import prisma from '../db';
import { sendTrackingPushNotification } from './notifications';

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
  const order = await prisma.order.findUnique({
    where: { shopifyOrderId }
  });

  if (!order) {
    console.error(`[Delhivery Tracking] Order not found for shopifyOrderId: ${shopifyOrderId}`);
    return;
  }

  const existingShipment = await prisma.shipment.findUnique({
    where: { awb }
  });

  let events: any[] = [];
  if (existingShipment && existingShipment.events) {
    try {
      events = JSON.parse(existingShipment.events);
    } catch (e) {
      events = [];
    }
  }

  // Avoid duplicate event insertions
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

  // Upsert the Shipment record
  await prisma.shipment.upsert({
    where: { awb },
    update: {
      status,
      currentLocation: location,
      updatedAt: new Date(),
      events: JSON.stringify(events)
    },
    create: {
      orderId: order.id,
      awb,
      trackingNumber: awb,
      courier: 'Delhivery',
      status,
      currentLocation: location,
      trackingUrl: `https://www.delhivery.com/track/package/${awb}`,
      events: JSON.stringify(events)
    }
  });

  // Update parent Order fields
  await prisma.order.update({
    where: { id: order.id },
    data: {
      tracking_status: status,
      deliveryStatus: status.toLowerCase()
    }
  });

  // Trigger push notification flow
  await sendTrackingPushNotification(awb, status);
}
