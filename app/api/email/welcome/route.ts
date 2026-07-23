import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { welcomeEmailTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, appDownloadUrl } = data;

    const { renderDBTemplate, welcomeEmailTemplate } = await import('@/lib/email-templates');

    const emailVars = {
      customerName: customerName || 'Valued Customer',
      customerEmail,
      appDownloadUrl: appDownloadUrl || 'https://zicabella.com/app',
    };

    const fallbackFn = () => welcomeEmailTemplate({
      customerName: emailVars.customerName,
      appDownloadUrl: emailVars.appDownloadUrl,
    });

    const rendered = await renderDBTemplate('WELCOME', emailVars, fallbackFn);

    const result = await sendMail({
      to: customerEmail,
      subject: rendered.subject || `Welcome to Zica Bella, ${emailVars.customerName}!`,
      html: rendered.html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: `Welcome Email`,
      templateName: 'welcomeEmail',
      triggerEvent: 'user/registration',
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
