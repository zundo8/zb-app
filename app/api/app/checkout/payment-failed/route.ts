import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { renderDBTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { customerEmail, customerName, orderId, total, paymentMethod, errorMessage } = data;

    if (!customerEmail) {
      return NextResponse.json({ success: false, error: 'Customer email is required' }, { status: 400, headers: corsHeaders });
    }

    const emailVars = {
      customerName: customerName || 'Customer',
      orderId: orderId || 'N/A',
      total: total ? `INR ${total}` : 'N/A',
      paymentMethod: paymentMethod || 'Razorpay',
      errorMessage: errorMessage || 'Transaction was declined by the bank or cancelled by the user.',
    };

    // Fallback payment failed template
    const fallbackFn = () => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #c62828;">Payment Failed</h1>
        <p>Dear ${emailVars.customerName},</p>
        <p>We attempted to process your payment for order <strong>#${emailVars.orderId}</strong>, but unfortunately, the transaction could not be completed.</p>
        <div style="background-color: #ffebee; border-left: 4px solid #ef5350; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <strong>Reason:</strong> ${emailVars.errorMessage}<br/>
          <strong>Amount:</strong> ${emailVars.total}<br/>
          <strong>Payment Method:</strong> ${emailVars.paymentMethod}
        </div>
        <p>Please return to the app or try placing your order again with a different payment method.</p>
        <p>If you have any questions, please reply to this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;"/>
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Zica Bella. All rights reserved.</p>
      </div>
    `;

    const rendered = await renderDBTemplate('PAYMENT_FAILED', emailVars, fallbackFn);

    const emailResult = await sendMail({
      to: customerEmail,
      subject: rendered.subject || `Action required — payment unsuccessful for #${orderId}`,
      html: rendered.html,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: customerName,
      subject: rendered.subject || `Action required — payment unsuccessful for #${orderId}`,
      templateName: 'paymentFailed',
      triggerEvent: 'checkout/payment-failed',
      referenceId: orderId,
      status: emailResult.messageId ? 'sent' : 'failed',
      messageId: emailResult.messageId,
    });

    return NextResponse.json({ success: true, messageId: emailResult.messageId }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Payment Failed Email Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
