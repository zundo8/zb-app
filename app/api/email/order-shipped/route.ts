import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { orderShippedTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, orderId, trackingNumber, trackingUrl, carrier, estimatedDelivery } = data;

    if (!customerEmail || !orderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const html = orderShippedTemplate({
      customerName,
      orderId,
      trackingNumber,
      trackingUrl,
      carrier,
      estimatedDelivery,
    });

    const result = await sendMail({
      to: customerEmail,
      subject: `Your order ${orderId} has been shipped!`,
      html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: `Order Shipped - ${orderId}`,
      templateName: 'orderShipped',
      triggerEvent: 'manual/shipped',
      referenceId: orderId,
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('Order Shipped Email Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
