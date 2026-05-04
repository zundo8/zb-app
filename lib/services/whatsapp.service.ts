import db from '../db';
import axios from 'axios';

const WHATSAPP_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const HEADERS = {
  Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

export const WhatsAppService = {
  /**
   * Sends a pre-approved template message
   */
  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en', 
    components: any[] = []
  ) {
    try {
      const response = await axios.post(WHATSAPP_URL, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }, { headers: HEADERS });

      return response.data;
    } catch (error: any) {
      console.error('WhatsApp template send error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Sends a free-form text message (only allowed within 24hr window)
   */
  async sendTextMessage(to: string, text: string) {
    try {
      const response = await axios.post(WHATSAPP_URL, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: true, body: text },
      }, { headers: HEADERS });

      return response.data;
    } catch (error: any) {
      console.error('WhatsApp text send error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Sends a media message (image, video, document)
   */
  async sendMediaMessage(to: string, type: 'image' | 'video' | 'document', url: string, caption?: string) {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type,
      };

      payload[type] = { link: url };
      if (caption) payload[type].caption = caption;

      const response = await axios.post(WHATSAPP_URL, payload, { headers: HEADERS });
      return response.data;
    } catch (error: any) {
      console.error(`WhatsApp ${type} send error:`, error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Mark an incoming message as read
   */
  async markAsRead(messageId: string) {
    try {
      const response = await axios.post(WHATSAPP_URL, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }, { headers: HEADERS });

      return response.data;
    } catch (error: any) {
      console.error('WhatsApp mark-as-read error:', error.response?.data || error.message);
      throw error;
    }
  },
  
  /**
   * Get formatting string for Indian phone numbers
   */
  formatPhone(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Add 91 if it's exactly 10 digits
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }
};
