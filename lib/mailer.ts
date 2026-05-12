import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_MAIL_HOST,
  port: Number(process.env.ZOHO_MAIL_PORT),
  secure: process.env.ZOHO_MAIL_SECURE === 'true',
  auth: {
    user: process.env.ZOHO_MAIL_USER,
    pass: process.env.ZOHO_MAIL_PASS,
  },
});

export async function sendMail({
  to,
  subject,
  html,
  cc,
  bcc,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
}) {
  return transporter.sendMail({
    from: process.env.ZOHO_MAIL_FROM,
    to,
    cc,
    bcc,
    replyTo,
    subject,
    html,
  });
}
