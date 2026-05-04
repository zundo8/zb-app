import sgMail from '@sendgrid/mail';
import db from '../db';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export const EmailService = {
  /**
   * Send a standard transactional or marketing email
   */
  async sendEmail(to: string | string[], subject: string, html: string, text?: string, fromName: string = 'Zica Bella') {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SENDGRID_API_KEY not set. Skipping email send.');
      return false;
    }

    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hello@zicabella.com',
        name: fromName,
      },
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''), // naive html to text if not provided
      html,
    };

    try {
      const response = await sgMail.send(msg);
      return response;
    } catch (error: any) {
      console.error('SendGrid error:', error);
      if (error.response) {
        console.error(error.response.body);
      }
      throw error;
    }
  },

  /**
   * Send using a SendGrid dynamic template
   */
  async sendTemplate(to: string, templateId: string, dynamicTemplateData: any, fromName: string = 'Zica Bella') {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SENDGRID_API_KEY not set. Skipping template email.');
      return false;
    }

    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hello@zicabella.com',
        name: fromName,
      },
      templateId,
      dynamicTemplateData,
    };

    try {
      return await sgMail.send(msg);
    } catch (error: any) {
      console.error('SendGrid template error:', error);
      throw error;
    }
  }
};
