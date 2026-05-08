import twilio from 'twilio';
import db from '../db';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const SmsService = {
  /**
   * Sends an SMS message via Twilio.
   * Tries environment variables first, then falls back to DB-stored credentials.
   * Throws an error if no valid credentials are found.
   */
  async sendSms(to: string, body: string, dltTemplateId?: string) {
    let activeClient = client;
    let activeFromNumber = fromNumber;
    let activeMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    // If environment variables are missing, try fetching from the database
    if (!activeClient || !activeFromNumber) {
      try {
        const shop = await db.shop.findFirst();
        if (shop?.twilioAccountSid && shop?.twilioAuthToken) {
          activeClient = twilio(shop.twilioAccountSid, shop.twilioAuthToken);
          activeFromNumber = shop.twilioPhoneNumber || undefined;
        }
      } catch (dbErr) {
        console.error('[SmsService] DB lookup failed:', dbErr);
      }
    }

    if (!activeClient || !activeFromNumber) {
      console.error('[SmsService] Twilio credentials not configured. Cannot send SMS.');
      throw new Error('SMS service is not configured. Please set up Twilio credentials in the admin dashboard.');
    }

    try {
      // Normalize phone number: ensure it has + prefix and only digits
      let formattedPhone = to.trim();
      // Remove any spaces, dashes, or parentheses
      formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/\D/g, '');
      }

      // Validate the phone number has enough digits
      const digits = formattedPhone.replace(/\D/g, '');
      if (digits.length < 10) {
        throw new Error(`Invalid phone number format: ${formattedPhone}`);
      }

      console.log(`[SmsService] Sending SMS to ${formattedPhone.slice(0, 4)}****${formattedPhone.slice(-4)}`);

      const messageOptions: any = {
        body,
        to: formattedPhone,
      };

      // Use messaging service if available, otherwise use the from number
      if (activeMessagingServiceSid) {
        messageOptions.messagingServiceSid = activeMessagingServiceSid;
      } else {
        messageOptions.from = activeFromNumber;
      }

      const response = await activeClient.messages.create(messageOptions);

      console.log(`[SmsService] SMS sent successfully. SID: ${response.sid}`);
      return response;
    } catch (error: any) {
      console.error('[SmsService] Twilio SMS error:', {
        code: error.code,
        message: error.message,
        status: error.status,
      });
      throw error;
    }
  }
};
