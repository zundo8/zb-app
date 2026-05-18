import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { orderCancelledTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, orderId, reason, refundAmount, refundTimeline } = data;

    const { renderDBTemplate, orderCancelledTemplate } = await import('@/lib/email-templates');

    const emailVars = {
      customerName,
      orderId,
      reason,
      refundAmount: refundAmount || '',
      refundTimeline: refundTimeline || '',
    };

    const fallbackFn = () => orderCancelledTemplate({
      customerName,
      orderId,
      reason,
      refundAmount,
      refundTimeline,
    });

    const rendered = await renderDBTemplate('ORDER_CANCELLED', emailVars, fallbackFn);

    const result = await sendMail({
      to: customerEmail,
      subject: rendered.subject || `Order Cancelled - ${orderId}`,
      html: rendered.html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: `Order Cancelled - ${orderId}`,
      templateName: 'orderCancelled',
      triggerEvent: 'manual/cancelled',
      referenceId: orderId,
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
