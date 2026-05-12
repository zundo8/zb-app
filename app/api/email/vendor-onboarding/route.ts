import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { vendorOnboardingTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { vendorEmail, vendorName, loginUrl, supportEmail } = data;

    const html = vendorOnboardingTemplate({
      vendorName,
      loginUrl,
      supportEmail: supportEmail || 'support@zicabella.com',
    });

    const result = await sendMail({
      to: vendorEmail,
      subject: `Welcome to Zica Bella Vendor Network`,
      html,
    });

    await logEmail({
      recipientEmail: vendorEmail,
      recipientName: vendorName,
      subject: `Vendor Onboarding`,
      templateName: 'vendorOnboarding',
      triggerEvent: 'manual/onboarding',
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
