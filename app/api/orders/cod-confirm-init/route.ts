import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { WhatsAppService } from '@/lib/services/whatsapp.service';

// In a real app, this would be secured, potentially called by a Shopify webhook or internal background job
export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.codConfirmationStatus && order.codConfirmationStatus !== 'pending') {
      return NextResponse.json({ error: 'Order already processed for COD' }, { status: 400 });
    }

    const phone = WhatsAppService.formatPhone(order.customer.phone || '');
    if (!phone) {
      return NextResponse.json({ error: 'Customer has no valid phone number' }, { status: 400 });
    }

    // Prepare template components
    // Template 'cod_confirmation' should exist in Meta Business Manager with variables:
    // {{1}} = Customer Name
    // {{2}} = Order Number
    // {{3}} = Total Amount
    // Button 1 Payload: COD_CONFIRM_{orderId}
    // Button 2 Payload: COD_CANCEL_{orderId}

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: order.customer.name || 'Valued Customer' },
          { type: 'text', text: order.shopifyOrderId || order.id },
          { type: 'text', text: `₹${(order as any).totalAmount || (order as any).totalPrice || 0}` }
        ]
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '0',
        parameters: [
          { type: 'payload', payload: `COD_CONFIRM_${order.id}` }
        ]
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '1',
        parameters: [
          { type: 'payload', payload: `COD_CANCEL_${order.id}` }
        ]
      }
    ];

    // Send WhatsApp template
    const response = await WhatsAppService.sendTemplateMessage(
      phone,
      'cod_confirmation',
      'en',
      components
    );

    // Update order status to pending
    await db.order.update({
      where: { id: order.id },
      data: {
        codConfirmationStatus: 'pending'
      }
    });

    // Log the message
    await db.whatsAppMessage.create({
      data: {
        direction: 'outbound',
        waMessageId: response.messages?.[0]?.id,
        phoneNumber: phone,
        userId: order.customer.id,
        templateName: 'cod_confirmation',
        orderId: order.id,
        status: 'sent'
      }
    });

    return NextResponse.json({ success: true, messageId: response.messages?.[0]?.id });

  } catch (error: any) {
    console.error('COD initiation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
