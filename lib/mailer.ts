import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in',
  port: Number(process.env.ZOHO_SMTP_PORT || '465'),
  secure: true, // port 465 with SSL
  auth: {
    user: process.env.ZOHO_SMTP_USER || 'developer@zicabella.com',
    pass: process.env.ZOHO_SMTP_PASS || 'L6YHDRkF1zti',
  },
});

// Verify the transporter on initialization in development mode only
if (process.env.NODE_ENV === 'development') {
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP Transporter verification failed:', error);
    } else {
      console.log('SMTP Transporter is ready to deliver messages ✓');
    }
  });
}

/**
 * Sends an email using the Zoho SMTP server
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  try {
    const fromName = process.env.ZOHO_FROM_NAME || 'Zica Bella';
    const fromEmail = process.env.ZOHO_FROM_EMAIL || 'developer@zicabella.com';
    const fromStr = `"${fromName}" <${fromEmail}>`;

    await transporter.sendMail({
      from: fromStr,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Legacy sendMail function to ensure backward compatibility with existing features
 */
export async function sendMail(options: {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}) {
  const fromName = process.env.ZOHO_FROM_NAME || 'Zica Bella';
  const fromEmail = process.env.ZOHO_FROM_EMAIL || 'developer@zicabella.com';
  const fromStr = `"${fromName}" <${fromEmail}>`;

  return transporter.sendMail({
    from: fromStr,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
  });
}
