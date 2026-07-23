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

    const { renderDBTemplate, orderShippedTemplate } = await import('@/lib/email-templates');

    const emailVars = {
      customerName: customerName || 'Valued Customer',
      customerEmail,
      orderId,
      trackingNumber: trackingNumber || 'N/A',
      trackingUrl: trackingUrl || (trackingNumber ? `https://zicabella.com/track?id=${trackingNumber}` : 'https://zicabella.com/account/orders'),
      carrier: carrier || 'Delhivery',
      courier: carrier || 'Delhivery',
      estimatedDelivery: estimatedDelivery || '3-5 business days',
    };

    const fallbackFn = () => orderShippedTemplate({
      customerName: emailVars.customerName,
      orderId,
      trackingNumber: emailVars.trackingNumber,
      trackingUrl: emailVars.trackingUrl,
      carrier: emailVars.carrier,
      estimatedDelivery: emailVars.estimatedDelivery,
    });

    const rendered = await renderDBTemplate('ORDER_SHIPPED', emailVars, fallbackFn);

    const result = await sendMail({
      to: customerEmail,
      subject: rendered.subject || `Your order ${orderId} has been shipped!`,
      html: rendered.html,
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
