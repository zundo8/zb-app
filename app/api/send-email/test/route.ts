import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

export async function GET(request: NextRequest) {
  // Only allow this endpoint in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Method Not Allowed in this environment' },
      { status: 405 }
    );
  }

  try {
    const testRecipient = 'developer@zicabella.com';
    
    await sendEmail({
      to: testRecipient,
      subject: 'Zica Bella SMTP Test ✓',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #C9A96E; border-radius: 8px; background-color: #000000; color: #ffffff;">
          <h1 style="color: #C9A96E; text-align: center; border-bottom: 1px solid #C9A96E; padding-bottom: 15px;">Zica Bella</h1>
          <p style="font-size: 16px; line-height: 1.6; color: #ffffff;">Hello,</p>
          <p style="font-size: 16px; line-height: 1.6; color: #ffffff; font-weight: bold;">SMTP is configured and working for Zica Bella.</p>
          <p style="font-size: 14px; line-height: 1.6; color: #a0a0a0; margin-top: 30px; text-align: center; border-top: 1px solid #333333; padding-top: 15px;">
            © Zica Bella | developer@zicabella.com | Faridabad, Haryana
          </p>
        </div>
      `,
      text: 'SMTP is configured and working for Zica Bella.',
    });

    return NextResponse.json(
      { success: true, message: `Test email sent to ${testRecipient}` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('SMTP Test Route Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}
