import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { orderDeliveredTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, orderId, reviewUrl } = data;

    const html = orderDeliveredTemplate({
      customerName,
      orderId,
      reviewUrl: reviewUrl || `https://zicabella.com/products/${orderId}/review`,
    });

    const result = await sendMail({
      to: customerEmail,
      subject: `Your order ${orderId} has been delivered!`,
      html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: `Order Delivered - ${orderId}`,
      templateName: 'orderDelivered',
      triggerEvent: 'status/delivered',
      referenceId: orderId,
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
