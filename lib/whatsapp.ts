/**
 * WhatsApp Business API — Send Message Utility
 * Location: lib/whatsapp.ts
 *
 * Lightweight standalone sender using native fetch.
 * For template-based sending, use lib/whatsapp/client.js or lib/whatsapp/templates.js.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function getToken(): string {
  return process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '';
}

function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
}

/**
 * Send a free-form text message via WhatsApp Cloud API.
 * Only valid within the 24-hour customer service window or for session messages.
 */
export async function sendWhatsAppMessage(to: string, message: string) {
  const phoneNumberId = getPhoneNumberId();
  const token = getToken();

  if (!phoneNumberId || !token) {
    throw new Error('WhatsApp not configured — missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_TOKEN');
  }

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('[WhatsApp] Send error:', err);
    throw new Error(err?.error?.message || 'Failed to send WhatsApp message');
  }

  return res.json();
}

/**
 * Send a pre-approved template message via WhatsApp Cloud API.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components: any[] = []
) {
  const phoneNumberId = getPhoneNumberId();
  const token = getToken();

  if (!phoneNumberId || !token) {
    throw new Error('WhatsApp not configured — missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_TOKEN');
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (components.length > 0) {
    payload.template.components = components;
  }

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('[WhatsApp] Template send error:', err);
    throw new Error(err?.error?.message || 'Failed to send WhatsApp template');
  }

  return res.json();
}
