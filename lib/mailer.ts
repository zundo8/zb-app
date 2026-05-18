import nodemailer from 'nodemailer';

const getSMTPConfig = () => {
  let user = process.env.ZOHO_SMTP_USER || '';
  let pass = process.env.ZOHO_SMTP_PASS || '';

  // If ZOHO_MAIL_USER is set and has a real password (no placeholder brackets), prioritize it
  const mailUser = process.env.ZOHO_MAIL_USER || '';
  const mailPass = process.env.ZOHO_MAIL_PASS || '';
  
  if (mailUser && mailPass && !mailPass.includes('<') && !mailPass.includes('placeholder')) {
    user = mailUser;
    pass = mailPass;
  }

  // Fallbacks if still empty
  if (!user) user = 'developer@zicabella.com';
  if (!pass) pass = 'L6YHDRkF1zti';

  const host = process.env.ZOHO_SMTP_HOST || process.env.ZOHO_MAIL_HOST || 'smtp.zoho.in';
  const port = Number(process.env.ZOHO_SMTP_PORT || process.env.ZOHO_MAIL_PORT || '465');

  return { host, port, user, pass };
};

export const resolvedSMTP = getSMTPConfig();

export const transporter = nodemailer.createTransport({
  host: resolvedSMTP.host,
  port: resolvedSMTP.port,
  secure: true, // port 465 with SSL
  auth: {
    user: resolvedSMTP.user,
    pass: resolvedSMTP.pass,
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
 * Helper to strip HTML tags and generate clean plain text fallback.
 * Essential for improving spam score as HTML-only emails are heavily flagged by email providers.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
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
    const fromEmail = resolvedSMTP.user;
    const fromStr = `"${fromName}" <${fromEmail}>`;
    const plainText = text || stripHtml(html);

    await transporter.sendMail({
      from: fromStr,
      to,
      subject,
      html,
      text: plainText,
      headers: {
        'X-Mailer': 'ZicaBellaMailer',
        'X-Priority': '3', // Normal priority
      }
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
  text?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}) {
  const fromName = process.env.ZOHO_FROM_NAME || 'Zica Bella';
  const fromEmail = resolvedSMTP.user;
  const fromStr = `"${fromName}" <${fromEmail}>`;
  const plainText = options.text || stripHtml(options.html);

  return transporter.sendMail({
    from: fromStr,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: plainText,
    headers: {
      'X-Mailer': 'ZicaBellaMailer',
      'X-Priority': '3', // Normal priority
    }
  });
}
