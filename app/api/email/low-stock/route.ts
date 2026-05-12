import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { lowStockAlertTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { products } = data; // Array of { name, sku, currentStock, threshold }

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@zicabella.com';
    const html = lowStockAlertTemplate({
      recipientName: 'Admin',
      products,
    });

    const result = await sendMail({
      to: adminEmail,
      subject: `Low Stock Alert - ${products.length} Items`,
      html,
    });

    await logEmail({
      recipientEmail: adminEmail,
      subject: `Low Stock Alert`,
      templateName: 'lowStockAlert',
      triggerEvent: 'cron/low-stock',
      status: result.messageId ? 'sent' : 'failed',
      messageId: result.messageId,
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
