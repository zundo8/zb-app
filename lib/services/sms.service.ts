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
    let activeClient = client;
    let activeFromNumber = fromNumber;
    let activeMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    // If environment variables are missing, try fetching from the database
    if (!activeClient || !activeFromNumber) {
      const shop = await db.shop.findFirst();
      if (shop?.twilioAccountSid && shop?.twilioAuthToken) {
        activeClient = twilio(shop.twilioAccountSid, shop.twilioAuthToken);
        activeFromNumber = shop.twilioPhoneNumber;
      }
    }

    if (!activeClient || !activeFromNumber) {
      console.warn('Twilio credentials not configured. Skipping SMS.');
      return { sid: 'mock-sid-dev-mode' };
    }

    try {
      // Clean up phone number but preserve + if it exists
      let formattedPhone = to.trim();
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/\D/g, '');
      }

      // Add DLT parameters if required for India
      // Note: Twilio currently doesn't natively accept DLT IDs in the standard create() payload without advanced config/headers,
      // but you might use a specific Sender ID that is mapped in the Twilio console.
      
      const response = await activeClient.messages.create({
        body,
        from: activeFromNumber,
        to: formattedPhone,
        // DLT might require appending a string or using messaging service
        ...(activeMessagingServiceSid ? { messagingServiceSid: activeMessagingServiceSid } : {})
      });

      return response;
    } catch (error: any) {
      console.error('Twilio SMS error:', error);
      throw error;
    }
  }
};
