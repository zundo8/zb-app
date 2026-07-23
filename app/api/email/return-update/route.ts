import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { returnUpdateTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, orderId, returnStatus, refundAmount, message } = data;

    const { renderDBTemplate, returnUpdateTemplate } = await import('@/lib/email-templates');

    const emailVars = {
      customerName: customerName || 'Valued Customer',
      customerEmail,
      orderId,
      returnStatus: returnStatus || 'Processed',
      refundAmount: refundAmount || '',
      message: message || 'Your return request has been updated.',
    };

    const fallbackFn = () => returnUpdateTemplate({
      customerName: emailVars.customerName,
      orderId,
      returnStatus: emailVars.returnStatus,
      refundAmount: emailVars.refundAmount,
      message: emailVars.message,
    });

    const rendered = await renderDBTemplate('RETURN_REFUND', emailVars, fallbackFn);

    const result = await sendMail({
      to: customerEmail,
      subject: rendered.subject || `Update on your return for order ${orderId}`,
      html: rendered.html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: `Return Update - ${orderId}`,
      templateName: 'returnUpdate',
      triggerEvent: 'status/return-update',
      referenceId: orderId,
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
