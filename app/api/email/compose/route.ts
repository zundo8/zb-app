import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { logEmail } from '@/lib/log-email';
import { baseTemplate } from '@/lib/email-templates/base';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { to, subject, html, recipientName } = data;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing to, subject, or html' }, { status: 400 });
    }

    // Wrap the custom HTML in our base template if it's not already a full document
    const finalHtml = html.includes('<!DOCTYPE') ? html : baseTemplate(html);

    const result = await sendMail({
      to,
      subject,
      html: finalHtml,
    });

    await logEmail({
      recipientEmail: to,
      recipientName: recipientName || 'N/A',
      subject,
      templateName: 'customCompose',
      triggerEvent: 'dashboard/compose',
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
      sentBy: 'admin-dashboard',
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('Compose Email Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
