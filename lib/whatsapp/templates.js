/**
 * WhatsApp Template Sender Functions
 * Location: lib/whatsapp/templates.js
 */

import { sendTemplate, formatPhone } from './client';
import { logMessage } from './logger';

/**
 * Helper to standardise template responses and logging.
 */
async function sendAndLog({ phone, templateName, type, components, rawParams }) {
  const formatted = formatPhone(phone);
  let messageId = null;
  let status = 'sent';
  let errorMsg = null;

  try {
    const result = await sendTemplate({
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
    // Log the event in the database logs table
    await logMessage({
      recipient_phone: formatted,
      message_type: type,
      template_name: templateName,
      message_id: messageId,
      status,
      payload: { ...rawParams, error: errorMsg }
    });
  }
}

/**
 * 2A — sendOrderConfirmation
 * Template: zb_order_confirmed (UTILITY)
 * Body: Hi {{1}}! Your Zica Bella order #{{2}} for ₹{{3}} has been confirmed...
 */
export async function sendOrderConfirmation({ phone, customerName, orderId, orderTotal }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) },
        { type: 'text', text: String(orderTotal) }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_order_confirmed',
    type: 'order_confirmed',
    components,
    rawParams: { customerName, orderId, orderTotal }
  });
}

/**
 * 2B — sendOrderStatus
 * Template: zb_order_status (UTILITY)
 * Body: Hi {{1}}! Your Zica Bella order #{{2}} status has been updated to: *{{3}}*. {{4}}
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
 * Template: zb_order_shipped (UTILITY)
 * Body: Great news, {{1}}! 📦 Your order #{{2}} is on its way. Courier: {{3}} | Tracking: {{4}} ...
 */
export async function sendShippingUpdate({ phone, customerName, orderId, courier, trackingNumber, estimatedDelivery }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) },
        { type: 'text', text: courier },
        { type: 'text', text: trackingNumber },
        { type: 'text', text: estimatedDelivery }
      ]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_order_shipped',
    type: 'order_shipped',
    components,
    rawParams: { customerName, orderId, courier, trackingNumber, estimatedDelivery }
  });
}

/**
 * 2D — sendOutForDelivery
 * Template: zb_out_for_delivery (UTILITY)
 * Body: Your Zica Bella order #{{1}} is out for delivery today! 🚚 Keep your phone handy, {{2}}.
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
 * Template: zb_order_delivered (UTILITY)
 * Body: Hi {{1}}! Your Zica Bella order #{{2}} has been delivered...
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
    templateName: 'zb_order_delivered',
    type: 'order_delivered',
    components,
    rawParams: { customerName, orderId }
  });
}

/**
 * 2F — sendReturnConfirmed
 * Template: zb_return_confirmed (UTILITY)
 * Body: Hi {{1}}, we've received your return request for order #{{2}}. Your refund of ₹{{3}}...
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
 * Template: zb_abandoned_cart (MARKETING)
 * Body: Hey {{1}}! 👀 You left something behind...
 * Button index 0 url suffix = {{1}}
 */
export async function sendAbandonedCart({ phone, customerName, itemCount, cartTotal, checkoutUrl }) {
  // Extract token suffix if full checkout URL is passed
  let suffix = checkoutUrl || '';
  if (suffix.includes('/')) {
    suffix = suffix.split('/').pop() || '';
  }

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(itemCount) },
        { type: 'text', text: String(cartTotal) }
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
    templateName: 'zb_abandoned_cart',
    type: 'abandoned_cart',
    components,
    rawParams: { customerName, itemCount, cartTotal, checkoutUrl }
  });
}

/**
 * 2H — sendNewCollection
 * Template: zb_new_collection (MARKETING)
 * Header: IMAGE (link = imageUrl)
 * Body: ✨ New Drop Alert, {{1}}!\n*{{2}}* is now live on Zica Bella.\n{{3}}
 * Button URL suffix: {{1}}
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
 * Body: 🔥 {{1}}, the Zica Bella sale is LIVE!\nUp to {{2}}% off on selected styles.\nSale ends: {{3}}
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
 * Body: Good news, {{1}}! ✅\n*{{2}}* in size {{3}} is back in stock...
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
 * Body: Welcome to Zica Bella, {{1}}! 🌟...
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
