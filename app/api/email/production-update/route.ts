import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { productionUpdateTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { vendorEmail, vendorName, taskId, productName, fromStage, toStage, notes, dashboardUrl } = data;

    const html = productionUpdateTemplate({
      vendorName,
      taskId,
      productName,
      fromStage,
      toStage,
      notes,
      dashboardUrl,
    });

    const result = await sendMail({
      to: vendorEmail,
      subject: `Production Update: ${productName} - ${toStage}`,
      html,
    });

    await logEmail({
      recipientEmail: vendorEmail,
      recipientName: vendorName,
      subject: `Production Update: ${productName}`,
      templateName: 'productionUpdate',
      triggerEvent: 'status/production-stage',
      referenceId: taskId,
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
