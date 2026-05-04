import twilio from 'twilio';
import db from '../db';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const SmsService = {
  /**
   * Sends an SMS message via Twilio
   */
  async sendSms(to: string, body: string, dltTemplateId?: string) {
    if (!client || !fromNumber) {
      console.warn('Twilio credentials not configured. Skipping SMS.');
      return { sid: 'mock-sid-dev-mode' };
    }

    try {
      // Clean up phone number
      let formattedPhone = to.replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone;
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      // Add DLT parameters if required for India
      // Note: Twilio currently doesn't natively accept DLT IDs in the standard create() payload without advanced config/headers,
      // but you might use a specific Sender ID that is mapped in the Twilio console.
      
      const response = await client.messages.create({
        body,
        from: fromNumber,
        to: formattedPhone,
        // DLT might require appending a string or using messaging service
        ...(process.env.TWILIO_MESSAGING_SERVICE_SID ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID } : {})
      });

      return response;
    } catch (error: any) {
      console.error('Twilio SMS error:', error);
      throw error;
    }
  }
};
