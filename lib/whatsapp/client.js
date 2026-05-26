/**
 * WhatsApp Business Platform Cloud API Core Client
 * Location: lib/whatsapp/client.js
 */

import prisma from '@/lib/db';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Helper to get active configuration and assert env vars.
 * If config is missing, returns an object detailing the failure instead of crashing.
 */
async function getConfig() {
  let dbPhoneId = null;
  let dbAccessToken = null;

  try {
    const shop = await prisma.shop.findFirst();
    if (shop) {
      dbPhoneId = shop.whatsappPhoneId;
      dbAccessToken = shop.whatsappToken;
    }
  } catch (err) {
    console.warn('[WhatsApp Client Config] Database lookup failed, using environment variables:', err.message);
  }

  const phoneId = dbPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = dbAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'zicabella_whatsapp_2026';

  if (!phoneId || !wabaId || !accessToken) {
    return {
      configured: false,
      error: 'WhatsApp configuration is incomplete. Missing: ' +
        [
          !phoneId && 'WHATSAPP_PHONE_NUMBER_ID',
          !wabaId && 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          !accessToken && 'WHATSAPP_ACCESS_TOKEN'
        ].filter(Boolean).join(', ')
    };
  }

  return {
    configured: true,
    phoneId,
    wabaId,
    accessToken,
    verifyToken
  };
}

/**
 * Formats a phone number: strips non-digits, removes leading 0, 
 * and prepends country code 91 for Indian numbers (10 digits).
 */
export function formatPhone(phone) {
  if (!phone) return '';
  // Strip all non-digits
  let cleaned = phone.toString().replace(/\D/g, '');
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  // Prepend 91 for Indian numbers if it's 10 digits
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Makes an authorized POST or GET request to the Meta Graph API.
 */
async function graphRequest({ endpoint, method = 'GET', payload = null }) {
  const config = await getConfig();
  if (!config.configured) {
    throw new Error(config.error);
  }

  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (payload && method !== 'GET') {
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.error?.message || response.statusText || 'GraphQL request failed';
    console.error(`[WhatsApp API Error] Endpoint: ${endpoint}, Status: ${response.status}`, data);
    throw new Error(errMsg);
  }

  return data;
}

/**
 * 1A — sendTemplate
 * Sends a pre-approved template message to a specific number.
 */
export async function sendTemplate({ to, templateName, languageCode = 'en', components = [] }) {
  const config = await getConfig();
  if (!config.configured) throw new Error(config.error);

  const formattedPhone = formatPhone(to);
  const endpoint = `/${config.phoneId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    }
  };

  if (components && components.length > 0) {
    payload.template.components = components;
  }

  return graphRequest({ endpoint, method: 'POST', payload });
}

/**
 * 1B — sendText
 * Sends a free-form customer service text message (valid within 24h window).
 */
export async function sendText({ to, message }) {
  const config = await getConfig();
  if (!config.configured) throw new Error(config.error);

  const formattedPhone = formatPhone(to);
  const endpoint = `/${config.phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'text',
    text: { body: message }
  };

  return graphRequest({ endpoint, method: 'POST', payload });
}

/**
 * 1C — createTemplate
 * Registers a new template in Meta for approval.
 */
export async function createTemplate({ name, category, language = 'en', components }) {
  const config = await getConfig();
  if (!config.configured) throw new Error(config.error);

  const endpoint = `/${config.wabaId}/message_templates`;

  const payload = {
    name,
    language,
    category, // UTILITY | MARKETING | AUTHENTICATION
    components
  };

  return graphRequest({ endpoint, method: 'POST', payload });
}

/**
 * 1D — listTemplates
 * Fetches WABA registered templates and their approval status.
 */
export async function listTemplates() {
  const config = await getConfig();
  if (!config.configured) throw new Error(config.error);

  const endpoint = `/${config.wabaId}/message_templates?fields=id,name,status,category,language,components&limit=1000`;
  const result = await graphRequest({ endpoint, method: 'GET' });
  return result.data || [];
}

/**
 * 1E — deleteTemplate
 * Deletes a template from the WABA account by name.
 */
export async function deleteTemplate(name) {
  const config = await getConfig();
  if (!config.configured) throw new Error(config.error);

  const endpoint = `/${config.wabaId}/message_templates?name=${encodeURIComponent(name)}`;
  return graphRequest({ endpoint, method: 'DELETE' });
}

/**
 * 1F — markAsRead
 * Marks a received message as read to acknowledge receipt to Meta.
 */
export async function markAsRead(messageId) {
  const config = await getConfig();
  if (!config.configured) throw new Error(config.error);

  const endpoint = `/${config.phoneId}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };

  return graphRequest({ endpoint, method: 'POST', payload });
}
