import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    // 1. Basic auth check using x-api-secret header
    const apiSecret = request.headers.get('x-api-secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedSecret || apiSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid API Secret.' },
        { status: 401 }
      );
    }

    // 2. Parse and validate body
    const body = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, and html are required.' },
        { status: 400 }
      );
    }

    // 3. Call sendEmail() from lib/mailer.ts
    await sendEmail({ to, subject, html, text });

    // 4. Return 200 on success
    return NextResponse.json(
      { success: true, message: 'Email sent' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API Send Email Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
