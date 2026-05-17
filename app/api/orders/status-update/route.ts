import { NextRequest, NextResponse } from 'next/server';
import {
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  OrderData,
} from '@/lib/services/orderEmailService';

export async function POST(request: NextRequest) {
  try {
    // 1. Basic auth check using x-api-secret header
    const apiSecret = request.headers.get('x-api-secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedSecret || apiSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid API Secret.' },
        { status: 401 }
      );
    }

    // 2. Parse and validate body
    const body = await request.json();
    const {
      orderId,
      newStatus,
      customerEmail,
      customerName,
      items,
      total,
      trackingNumber,
      courier,
      currency,
      orderDate,
    } = body;

    if (!orderId || !newStatus || !customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: orderId, newStatus, customerEmail' },
        { status: 400 }
      );
    }

    // Normalize customerName if missing
    const resolvedName = customerName || 'Valued Customer';
    // Normalize items if missing
    const resolvedItems = items || [];
    // Normalize total if missing
    const resolvedTotal = total !== undefined ? Number(total) : 0;

    const orderPayload: OrderData = {
      orderId,
      customerEmail,
      customerName: resolvedName,
      items: resolvedItems,
      total: resolvedTotal,
      currency: currency || 'INR',
      orderDate: orderDate,
    };

    // 3. Based on newStatus, trigger the right email
    const status = String(newStatus).toLowerCase();
    let emailSent = false;
    let trigger = '';

    if (['confirmed', 'placed', 'processing', 'approved'].includes(status)) {
      await sendOrderConfirmationEmail(orderPayload);
      emailSent = true;
      trigger = 'confirmation';
    } else if (['shipped', 'out_for_delivery', 'dispatched', 'ready for dispatch'].includes(status)) {
      await sendOrderShippedEmail({
        ...orderPayload,
        trackingNumber,
        courier,
      });
      emailSent = true;
      trigger = 'shipped';
    } else if (['delivered', 'completed'].includes(status)) {
      await sendOrderDeliveredEmail(orderPayload);
      emailSent = true;
      trigger = 'delivered';
    }

    // 4. Return success response
    return NextResponse.json(
      { success: true, emailSent, trigger },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API Order Status Update Email Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process status update email' },
      { status: 500 }
    );
  }
}
