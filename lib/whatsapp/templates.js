/**
 * WhatsApp Template Sender Functions with Opt-In Compliance Enforcement
 * Location: lib/whatsapp/templates.js
 */

import { sendTemplate, formatPhone } from './client';
import { logMessage } from './logger';
import prisma from '@/lib/db';

/**
 * Checks if a phone number is opted in for WhatsApp marketing messages.
 */
export async function isOptedIn(phone) {
  const formatted = formatPhone(phone);
  if (!formatted) return false;

  // 1. Check whatsapp_opt_ins table first
  try {
    const record = await prisma.whatsAppOptIn.findUnique({
      where: { phone: formatted }
    });
    if (record) {
      return record.status === 'opted_in';
    }
  } catch (err) {
    console.warn('[WhatsApp Consent Check] failed to query whatsapp_opt_ins:', err.message);
  }

  // 2. Fallback check to Customer / CommunityMember
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        phone: {
          endsWith: formatted.slice(-10)
        }
      },
      include: {
        communityMember: true
      }
    });

    if (customer) {
      return !customer.whatsappOptedOut;
    }

    const member = await prisma.communityMember.findFirst({
      where: {
        phone: {
          endsWith: formatted.slice(-10)
        }
      }
    });

    return member ? member.whatsappOptIn !== false : true;
  } catch (err) {
    console.warn('[WhatsApp Consent Check] Fallback check failed:', err.message);
    return true; // Default to true to avoid blocking standard communications
  }
}

/**
 * Helper to standardise template responses, verify consent, and perform logging.
 */
async function sendAndLog({ phone, templateName, type, components, rawParams }) {
  const formatted = formatPhone(phone);
  
  // Verify consent for marketing messages
  const marketingTemplates = ['zica_cart_recovery_v1', 'zb_abandoned_cart', 'zb_new_collection', 'zb_sale_alert', 'zb_restock_alert', 'zb_welcome'];
  const isMarketing = marketingTemplates.includes(templateName) || ['abandoned_cart', 'new_collection', 'sale_alert', 'restock_alert', 'welcome'].includes(type);

  if (isMarketing) {
    const consented = await isOptedIn(formatted);
    if (!consented) {
      const errorMsg = 'Recipient has not opted in to receive marketing messages';
      console.warn(`[WhatsApp Template Sender] Consent blocked for template ${templateName} to ${formatted}`);
      await logMessage({
        to_number: formatted,
        template_name: templateName,
        message_body: `Template: ${templateName} (Blocked: Consent)`,
        status: 'failed',
        message_id: null,
        error_details: { error: errorMsg }
      });
      return { success: false, error: errorMsg };
    }
  }

  let messageId = null;
  let status = 'sent';
  let errorMsg = null;
  let result = null;

  try {
    result = await sendTemplate({
      to: formatted,
      templateName,
      languageCode: 'en',
      components
    });

    messageId = result.messages?.[0]?.id || null;
    return { success: true, messageId, result };
  } catch (error) {
    status = 'failed';
    errorMsg = error.message;
    console.error(`[WhatsApp Template Sender] Failed to send ${templateName}:`, error);
    return { success: false, error: errorMsg };
  } finally {
    // Log the event in the database logs table (whatsapp_messages / whatsapp_message_logs)
    let bodyText = `Template: ${templateName}`;
    if (components && components.length > 0) {
      bodyText += ` | Parameters: ${JSON.stringify(components)}`;
    }

    await logMessage({
      to_number: formatted,
      template_name: templateName,
      message_body: bodyText,
      status,
      message_id: messageId,
      error_details: errorMsg ? { error: errorMsg } : null
    });
  }
}

/**
 * 2A — sendOrderConfirmation
 * Template: zica_order_confirmed (UTILITY)
 * Body: Hi {{1}},\nYour order {{2}} has been confirmed.
 */
export async function sendOrderConfirmation({ phone, customerName, orderId }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zica_order_confirmed_v1',
    type: 'order_confirmed',
    components,
    rawParams: { customerName, orderId }
  });
}

/**
 * 2B — sendOrderStatus (Generic updates)
 * Template: zb_order_status (UTILITY)
 */
export async function sendOrderStatus({ phone, customerName, orderId, status, extraInfo }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) },
        { type: 'text', text: status },
        { type: 'text', text: extraInfo || '' }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_order_status',
    type: 'order_status',
    components,
    rawParams: { customerName, orderId, status, extraInfo }
  });
}

/**
 * 2C — sendShippingUpdate
 * Template: zica_order_shipped (UTILITY)
 * Body: Hi {{1}},\nYour order {{2}} has been shipped.\nTracking ID: {{3}}
 */
export async function sendShippingUpdate({ phone, customerName, orderId, trackingNumber }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) },
        { type: 'text', text: String(trackingNumber) }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zica_order_shipped',
    type: 'order_shipped',
    components,
    rawParams: { customerName, orderId, trackingNumber }
  });
}

/**
 * 2D — sendOutForDelivery
 * Template: zb_out_for_delivery (UTILITY)
 */
export async function sendOutForDelivery({ phone, orderId, customerName }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: String(orderId) },
        { type: 'text', text: customerName || 'there' }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_out_for_delivery',
    type: 'out_for_delivery',
    components,
    rawParams: { orderId, customerName }
  });
}

/**
 * 2E — sendDelivered
 * Template: zica_order_delivered (UTILITY)
 * Body: Hi {{1}},\nYour order {{2}} has been delivered.
 */
export async function sendDelivered({ phone, customerName, orderId }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zica_order_delivered_v1',
    type: 'order_delivered',
    components,
    rawParams: { customerName, orderId }
  });
}

/**
 * 2F — sendReturnConfirmed
 * Template: zb_return_confirmed (UTILITY)
 */
export async function sendReturnConfirmed({ phone, customerName, orderId, refundAmount }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) },
        { type: 'text', text: String(refundAmount) }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_return_confirmed',
    type: 'return_confirmed',
    components,
    rawParams: { customerName, orderId, refundAmount }
  });
}

/**
 * 2G — sendAbandonedCart
 * Template: zica_cart_recovery (MARKETING)
 * Body: Hi {{1}},\nYou left products in your cart.\n\nComplete your purchase today.
 */
export async function sendAbandonedCart({ phone, customerName, checkoutUrl }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zica_cart_recovery_v1',
    type: 'abandoned_cart',
    components,
    rawParams: { customerName, checkoutUrl }
  });
}

/**
 * 2H — sendNewCollection
 * Template: zb_new_collection (MARKETING)
 */
export async function sendNewCollection({ phone, customerName, collectionName, tagline, imageUrl, shopUrl }) {
  let suffix = shopUrl || '';
  if (suffix.includes('/')) {
    suffix = suffix.split('/').pop() || '';
  }

  const components = [
    {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: imageUrl }
        }
      ]
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: collectionName },
        { type: 'text', text: tagline }
      ]
    },
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [
        { type: 'text', text: suffix }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_new_collection',
    type: 'new_collection',
    components,
    rawParams: { customerName, collectionName, tagline, imageUrl, shopUrl }
  });
}

/**
 * 2I — sendSaleAlert
 * Template: zb_sale_alert (MARKETING)
 */
export async function sendSaleAlert({ phone, customerName, discountPercent, saleEndDate }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(discountPercent) },
        { type: 'text', text: saleEndDate }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_sale_alert',
    type: 'sale_alert',
    components,
    rawParams: { customerName, discountPercent, saleEndDate }
  });
}

/**
 * 2J — sendRestockAlert
 * Template: zb_restock_alert (MARKETING)
 */
export async function sendRestockAlert({ phone, customerName, productName, size }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: productName },
        { type: 'text', text: size }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_restock_alert',
    type: 'restock_alert',
    components,
    rawParams: { customerName, productName, size }
  });
}

/**
 * 2K — sendWelcome
 * Template: zb_welcome (MARKETING)
 */
export async function sendWelcome({ phone, customerName }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_welcome',
    type: 'welcome',
    components,
    rawParams: { customerName }
  });
}

/**
 * 2L — sendCODConfirmation
 * Template: zica_cod_confirmation (UTILITY)
 * Body: Hi {{1}},\nPlease confirm your COD order {{2}}.
 */
export async function sendCODConfirmation({ phone, customerName, orderId }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) }
      ]
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '0',
      parameters: [
        { type: 'payload', payload: `COD_CONFIRM_${orderId}` }
      ]
    },
    {
      type: 'button',
      sub_type: 'quick_reply',
      index: '1',
      parameters: [
        { type: 'payload', payload: `COD_CANCEL_${orderId}` }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zica_cod_confirmation_v1',
    type: 'cod_confirmation',
    components,
    rawParams: { customerName, orderId }
  });
}
