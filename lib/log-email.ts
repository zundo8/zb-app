import { prisma } from './db';

export async function logEmail(data: {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  templateName: string;
  triggerEvent?: string;
  referenceId?: string;
  status: 'sent' | 'failed';
  messageId?: string;
  errorMessage?: string;
  sentBy?: string;
}) {
  try {
    return await prisma.emailLog.create({
      data: {
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName,
        subject: data.subject,
        templateName: data.templateName,
        triggerEvent: data.triggerEvent,
        referenceId: data.referenceId,
        status: data.status,
        messageId: data.messageId,
        errorMessage: data.errorMessage,
        sentBy: data.sentBy || 'system',
      },
    });
  } catch (error) {
    console.error('Failed to log email:', error);
  }
}
