import twilio from 'twilio';
import db from '../db';

function getTwilioClient(sid?: string | null, token?: string | null) {
  const activeSid = sid || process.env.TWILIO_ACCOUNT_SID;
  const activeToken = token || process.env.TWILIO_AUTH_TOKEN;
  if (activeSid && activeToken) {
    return twilio(activeSid, activeToken);
  }
  return null;
}

export const SmsService = {
  /**
   * Sends an SMS message via Twilio.
   * Tries environment variables first, then falls back to DB-stored credentials.
   * Throws an error if no valid credentials are found.
   */
  async sendSms(to: string, body: string, dltTemplateId?: string) {
    let activeClient = getTwilioClient();
    let activeFromNumber = process.env.TWILIO_PHONE_NUMBER || undefined;
    let activeMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    // If environment variables are missing, try fetching from the database
    if (!activeClient || !activeFromNumber) {
      try {
        const shop = await db.shop.findFirst();
        if (shop?.twilioAccountSid && shop?.twilioAuthToken) {
          activeClient = getTwilioClient(shop.twilioAccountSid, shop.twilioAuthToken);
          activeFromNumber = shop.twilioPhoneNumber || undefined;
        }
      } catch (dbErr) {
        console.error('[SmsService] DB lookup failed:', dbErr);
      }
    }

    if (!activeClient) {
      console.warn('[SmsService] Twilio client not initialized.');
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV FALLBACK] SMS to ${to}: ${body}`);
        return { sid: 'mock_sid' };
      }
      throw new Error('Twilio service is not configured correctly.');
    }

    try {
      // Normalize phone number
      let formattedPhone = to.trim();
      formattedPhone = formattedPhone.replace(/[\s\-\(\)]/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/\D/g, '');
      }

      console.log(`[SmsService] Attempting to send SMS to ${formattedPhone.slice(0, 4)}****${formattedPhone.slice(-4)}`);

      const messageOptions: any = {
        body,
        to: formattedPhone,
      };

      if (activeMessagingServiceSid) {
        messageOptions.messagingServiceSid = activeMessagingServiceSid;
      } else if (activeFromNumber) {
        messageOptions.from = activeFromNumber;
      } else {
        throw new Error('No sender (phone number or messaging service) configured.');
      }

      const response = await activeClient.messages.create(messageOptions);
      console.log(`[SmsService] SMS sent successfully. SID: ${response.sid}`);
      return response;
    } catch (error: any) {
      console.error('[SmsService] Twilio SMS error detail:', error);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV FALLBACK] SMS to ${to}: ${body}`);
        return { sid: 'mock_sid' };
      }
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  },

  /**
   * Sends a verification code via Twilio Verify API.
   */
  async sendVerification(to: string) {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const activeClient = getTwilioClient();
    if (!activeClient || !serviceSid) {
      console.log('[SmsService] Twilio Verify not configured, falling back to manual SMS.');
      return null;
    }

    try {
      let formattedPhone = to.trim().replace(/[\s\-\(\)]/g, '');
      if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone.replace(/\D/g, '');

      const verification = await activeClient.verify.v2.services(serviceSid)
        .verifications
        .create({ to: formattedPhone, channel: 'sms' });
      
      console.log(`[SmsService] Verify OTP sent to ${formattedPhone}. SID: ${verification.sid}`);
      return verification;
    } catch (error: any) {
      console.error('[SmsService] Twilio Verify send error:', error);
      throw error;
    }
  },

  /**
   * Checks a verification code via Twilio Verify API.
   */
  async checkVerification(to: string, code: string) {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const activeClient = getTwilioClient();
    if (!activeClient || !serviceSid) return null;

    try {
      let formattedPhone = to.trim().replace(/[\s\-\(\)]/g, '');
      if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone.replace(/\D/g, '');

      const check = await activeClient.verify.v2.services(serviceSid)
        .verificationChecks
        .create({ to: formattedPhone, code });
      
      console.log(`[SmsService] Verify OTP check for ${formattedPhone}: ${check.status}`);
      return check.status === 'approved';
    } catch (error: any) {
      console.error('[SmsService] Twilio Verify check error:', error);
      return false;
    }
  }
};
