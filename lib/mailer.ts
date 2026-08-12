import nodemailer from 'nodemailer';
import { stripMarkdown } from '@/lib/ai/formatSanitizer';

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
  transporter.verify((error) => {
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

export interface BuildSupportEmailOptions {
  ticketId: string;
  subject: string;
  senderName: string;
  content: string;
  customerName?: string;
}

export function buildSupportEmailHtml({
  ticketId,
  subject,
  senderName,
  content,
  customerName,
}: BuildSupportEmailOptions): string {
  const shortId = ticketId.slice(-6).toUpperCase();
  const greetingName = customerName ? customerName : 'Valued Customer';
  
  const cleanContent = stripMarkdown(content);

  const paragraphs = cleanContent
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 10px 0; line-height: 1.6; color: #1a1a1a;">${line}</p>`)
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #000000;">ZICA BELLA</h2>
        <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #666666;">Customer Support</p>
      </div>

      <div style="padding: 24px 0;">
        <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">Hello ${greetingName},</p>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #555555; line-height: 1.5;">You have a new message regarding your ticket "<strong>${subject}</strong>" (Ticket #${shortId}):</p>
        
        <div style="background-color: #f8f8fb; border-left: 4px solid #000000; padding: 18px 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #888888;">${senderName}:</p>
          <div style="font-size: 13px; color: #1a1a1a;">
            ${paragraphs}
          </div>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 12px; color: #777777;">You can reply to this email or visit our website to view your ticket.</p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center;">
        <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #444444;">Zica Bella Support Team</p>
        <p style="margin: 4px 0 0 0; font-size: 10px; color: #999999;">Luxury Indian Streetwear | www.zicabella.com</p>
      </div>
    </div>
  `;
}
