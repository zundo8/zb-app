import db from '../db';
import axios from 'axios';

async function getDynamicConfig() {
  let dbPhoneId = null;
  let dbAccessToken = null;

  try {
    const list = await db.whatsAppSetting.findMany();
    const settings = Object.fromEntries(list.map((s: any) => [s.key, s.value]));
    dbPhoneId = settings['whatsapp_phone_number_id'];
    dbAccessToken = settings['whatsapp_access_token'];
  } catch (err: any) {
    console.warn('[WhatsApp Service Config] whatsapp_settings lookup failed:', err.message);
  }

  if (!dbPhoneId || !dbAccessToken) {
    try {
      const shop = await db.shop.findFirst();
      if (shop) {
        dbPhoneId = dbPhoneId || shop.whatsappPhoneId;
        dbAccessToken = dbAccessToken || shop.whatsappToken;
      }
    } catch (err: any) {
      console.warn('[WhatsApp Service Config] Database lookup failed, using environment variables:', err.message);
    }
  }

  const phoneId = dbPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = dbAccessToken || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';

  if (!phoneId || !accessToken) {
    throw new Error(`WhatsApp is not configured. Missing: ${!phoneId ? 'WHATSAPP_PHONE_NUMBER_ID ' : ''}${!accessToken ? 'WHATSAPP_ACCESS_TOKEN' : ''}`);
  }

  return {
    url: `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  };
}

function handleAxiosError(error: any): never {
  const metaError = error.response?.data?.error;
  if (metaError) {
    const errMsg = metaError.message || metaError.error_user_msg || error.message;
    console.error('[WhatsApp Service API Error]:', metaError);
    const err: any = new Error(errMsg);
    err.code = metaError.code;
    err.subcode = metaError.error_subcode || metaError.subcode;
    err.fbtrace_id = metaError.fbtrace_id;
    throw err;
  }
  throw error;
}

export const WhatsAppService = {
  formatPhone(phone: string) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/\D/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    if (cleaned.length < 7 || cleaned.length > 15) return '';
    return cleaned;
  },

  /**
   * Sends a pre-approved template message with automatic language fallback and logging
   */
  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en_US', 
    components: any[] = []
  ) {
    try {
      const { sendTemplate, formatPhone: clientFormatPhone } = await import('@/lib/whatsapp/client');
      const formatted = clientFormatPhone(to) || to;
      const result = await sendTemplate({
        to: formatted,
        templateName,
        languageCode,
        components: (components as any[]) || []
      });
      return result;
    } catch (error: any) {
      console.error('WhatsApp template send error:', error.message);
      handleAxiosError(error);
    }
  },

  /**
   * Sends a free-form text message (only allowed within 24hr window) and logs to DB
   */
  async sendTextMessage(to: string, text: string) {
    try {
      const config = await getDynamicConfig();
      const response = await axios.post(config.url, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: true, body: text },
      }, { headers: config.headers });

      const data = response.data;
      const messageId = data?.messages?.[0]?.id || null;

      try {
        const { logMessage } = await import('@/lib/whatsapp/logger');
        await logMessage({
          to_number: to,
          template_name: null,
          message_body: text,
          status: 'sent',
          message_id: messageId,
          error_details: null
        });
      } catch (e) {}

      return data;
    } catch (error: any) {
      console.error('WhatsApp text send error:', error.response?.data || error.message);
      try {
        const { logMessage } = await import('@/lib/whatsapp/logger');
        await logMessage({
          to_number: to,
          template_name: null,
          message_body: text,
          status: 'failed',
          message_id: null,
          error_details: { error: error.response?.data?.error?.message || error.message }
        });
      } catch (e) {}
      handleAxiosError(error);
    }
  },

  /**
   * Sends a media message (image, video, document) and logs to DB
   */
  async sendMediaMessage(to: string, type: 'image' | 'video' | 'document', url: string, caption?: string) {
    try {
      const config = await getDynamicConfig();
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type,
      };

      payload[type] = { link: url };
      if (caption) payload[type].caption = caption;

      const response = await axios.post(config.url, payload, { headers: config.headers });
      const data = response.data;
      const messageId = data?.messages?.[0]?.id || null;

      try {
        const { logMessage } = await import('@/lib/whatsapp/logger');
        await logMessage({
          to_number: to,
          template_name: null,
          message_body: caption ? `[Media: ${type}] ${caption}` : `[Media: ${type}] ${url}`,
          status: 'sent',
          message_id: messageId,
          error_details: null
        });
      } catch (e) {}

      return data;
    } catch (error: any) {
      console.error(`WhatsApp ${type} send error:`, error.response?.data || error.message);
      try {
        const { logMessage } = await import('@/lib/whatsapp/logger');
        await logMessage({
          to_number: to,
          template_name: null,
          message_body: caption ? `[Media: ${type}] ${caption}` : `[Media: ${type}] ${url}`,
          status: 'failed',
          message_id: null,
          error_details: { error: error.response?.data?.error?.message || error.message }
        });
      } catch (e) {}
      handleAxiosError(error);
    }
  },

  /**
   * Mark an incoming message as read
   */
  async markAsRead(messageId: string) {
    try {
      const config = await getDynamicConfig();
      const response = await axios.post(config.url, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }, { headers: config.headers });

      return response.data;
    } catch (error: any) {
      console.error('WhatsApp mark-as-read error:', error.response?.data || error.message);
      handleAxiosError(error);
    }
  }
};
