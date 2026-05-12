import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { passwordResetTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, resetUrl, expiresIn } = data;

    const html = passwordResetTemplate({
      customerName,
      resetUrl,
      expiresIn: expiresIn || '1 hour',
    });

    const result = await sendMail({
      to: customerEmail,
      subject: `Reset your Zica Bella password`,
      html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: `Password Reset`,
      templateName: 'passwordReset',
      triggerEvent: 'user/password-reset-request',
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
