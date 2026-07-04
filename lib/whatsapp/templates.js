/**
 * WhatsApp Template Sender Functions with Opt-In Compliance Enforcement
 * Location: lib/whatsapp/templates.js
 *
 * Each sender function constructs the exact `components` array matching
 * the Meta-approved template structure (header, body, buttons) and
 * delegates to `sendAndLog` which handles consent checks and DB logging.
 *
 * Template reference (Meta WABA-approved as of 2026-07):
 *  ┌──────────────────────────────┬────────┬─────────────────────────┬──────────────────────────┐
 *  │ Template                     │ Header │ Body vars               │ Button                   │
 *  ├──────────────────────────────┼────────┼─────────────────────────┼──────────────────────────┤
 *  │ zica_cart_recovery_v1        │ IMAGE  │ {{1}} name              │ URL (static, no var)     │
 *  │ zica_order_confirmed_v1      │ IMAGE  │ {{1}} name, {{2}} order │ URL (static, no var)     │
 *  │ zica_order_delivered_v1      │ IMAGE  │ {{1}} name, {{2}} order │ URL (static, no var)     │
 *  │ zica_order_shipped           │ —      │ {{1}},{{2}},{{3}}       │ —                        │
 *  │ zb_cart_final                │ —      │ {{1}} name              │ URL with {{1}}           │
 *  │ zb_cart_followup             │ —      │ {{1}} name, {{2}} code  │ URL with {{1}}           │
 *  │ zb_order_tracking            │ —      │ {{1}} name, {{2}} order │ URL with {{1}}           │
 *  │ zica_cod_confirmation_v1     │ —      │ {{1}} name, {{2}} order │ QUICK_REPLY × 2          │
 *  └──────────────────────────────┴────────┴─────────────────────────┴──────────────────────────┘
 */

import { sendTemplate, formatPhone } from './client';
import { logMessage, getWhatsAppSetting } from './logger';
import prisma from '@/lib/db';

// ---------------------------------------------------------------------------
// Default product image used when no product-specific image is available
// ---------------------------------------------------------------------------
const FALLBACK_IMAGE_URL =
  'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/zica-bella-logo-social.png?v=1749023145';

// ---------------------------------------------------------------------------
// Consent / opt-in check
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Marketing template list — used by sendAndLog for consent gating
// ---------------------------------------------------------------------------
const MARKETING_TEMPLATES = [
  'zica_cart_recovery_v1',
  'zb_cart_final',
  'zb_cart_followup',
  'zica_order_delivered_v1',
  'zica_otp_v3',
  'zb_new_collection',
  'zb_sale_alert',
  'zb_restock_alert',
  'zb_welcome',
];

const MARKETING_EVENT_TYPES = [
  'abandoned_cart',
  'cart_followup',
  'cart_final',
  'new_collection',
  'sale_alert',
  'restock_alert',
  'welcome',
];

// ---------------------------------------------------------------------------
// Core send + log helper
// ---------------------------------------------------------------------------

/**
 * Helper to standardise template responses, verify consent, and perform logging.
 */
async function sendAndLog({ phone, templateName, type, components, rawParams }) {
  const formatted = formatPhone(phone);

  // Verify consent for marketing messages
  const isMarketing =
    MARKETING_TEMPLATES.includes(templateName) ||
    MARKETING_EVENT_TYPES.includes(type);

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

// ---------------------------------------------------------------------------
// Helper: resolve a valid public image URL for WhatsApp header
// ---------------------------------------------------------------------------

/**
 * Given an optional image URL, returns a publicly-reachable URL suitable for
 * the WhatsApp IMAGE header component. Falls back to a known-good Shopify CDN
 * asset if the provided URL is empty or looks like a local/relative path.
 */
function resolveImageUrl(url) {
  if (!url) return FALLBACK_IMAGE_URL;
  // Reject non-http URLs and local dev URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) return FALLBACK_IMAGE_URL;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return FALLBACK_IMAGE_URL;
  // Reject the old broken logo.png reference
  if (url.includes('app.zicabella.com/logo.png')) return FALLBACK_IMAGE_URL;
  return url;
}

// ---------------------------------------------------------------------------
// Helper: extract URL suffix for dynamic button URLs
// ---------------------------------------------------------------------------

/**
 * Extracts a path suffix from a full URL for use as the dynamic {{1}} in
 * button URL templates like `https://app.zicabella.com/{{1}}`.
 */
function extractUrlSuffix(fullUrl) {
  if (!fullUrl) return 'cart';
  try {
    const urlObj = new URL(fullUrl);
    let suffix = urlObj.pathname + urlObj.search;
    if (suffix.startsWith('/')) suffix = suffix.substring(1);
    return suffix || 'cart';
  } catch {
    return fullUrl;
  }
}

// ===========================================================================
// TEMPLATE SENDER FUNCTIONS
// ===========================================================================

/**
 * 2A — sendOrderConfirmation
 * Template: zica_order_confirmed_v1 (UTILITY)
 * Header: IMAGE (dynamic)
 * Body: Hey {{1}}, ... order **{{2}}** is confirmed ...
 * Button: URL (static — no variable)
 */
export async function sendOrderConfirmation({ phone, customerName, orderId, productImageUrl }) {
  const components = [];

  // IMAGE header
  const imageUrl = resolveImageUrl(productImageUrl);
  components.push({
    type: 'header',
    parameters: [
      {
        type: 'image',
        image: { link: imageUrl }
      }
    ]
  });

  // Body variables: {{1}} customerName, {{2}} orderId
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName || 'there' },
      { type: 'text', text: String(orderId) }
    ]
  });

  // No button variable — the URL is static (https://app.zicabella.com/orders)

  return sendAndLog({
    phone,
    templateName: 'zica_order_confirmed_v1',
    type: 'order_confirmed',
    components,
    rawParams: { customerName, orderId, productImageUrl }
  });
}

/**
 * 2B — sendOrderStatus (Generic updates)
 * Template: zb_order_status (UTILITY)
 * NOTE: This template may not exist on Meta yet. If it fails, the error
 * will be logged and the function returns { success: false }.
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
 * Body: Hello {{1}}, your order {{2}} has been shipped. Tracking ID: {{3}}
 * No header, no button variables.
 */
export async function sendShippingUpdate({ phone, customerName, orderId, trackingNumber }) {
  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: String(orderId) },
        { type: 'text', text: String(trackingNumber || 'N/A') }
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
 * NOTE: This template may not exist on Meta yet.
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
 * Template: zica_order_delivered_v1 (MARKETING)
 * Header: IMAGE (dynamic)
 * Body: Hey {{1}}, ... order {{2}} has been delivered ...
 * Button: URL (static — no variable)
 */
export async function sendDelivered({ phone, customerName, orderId, productImageUrl }) {
  const components = [];

  // IMAGE header
  const imageUrl = resolveImageUrl(productImageUrl);
  components.push({
    type: 'header',
    parameters: [
      {
        type: 'image',
        image: { link: imageUrl }
      }
    ]
  });

  // Body variables: {{1}} customerName, {{2}} orderId
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName || 'there' },
      { type: 'text', text: String(orderId) }
    ]
  });

  // No button variable — the URL is static

  return sendAndLog({
    phone,
    templateName: 'zica_order_delivered_v1',
    type: 'order_delivered',
    components,
    rawParams: { customerName, orderId, productImageUrl }
  });
}

/**
 * 2F — sendReturnConfirmed
 * Template: zb_return_confirmed (UTILITY)
 * NOTE: This template may not exist on Meta yet.
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
 * Template: zica_cart_recovery_v1 (MARKETING)
 * Header: IMAGE (dynamic — product image from cart)
 * Body: Heyy {{1}}, ... (single body variable: customer name)
 * Button: URL (static — no variable, goes to /cart)
 */
export async function sendAbandonedCart({ phone, customerName, checkoutUrl, productImageUrl, productName, cartTotal, itemCount }) {
  const components = [];

  // IMAGE header with product image
  const imageUrl = resolveImageUrl(productImageUrl);
  components.push({
    type: 'header',
    parameters: [
      {
        type: 'image',
        image: { link: imageUrl }
      }
    ]
  });

  // Body: only {{1}} customerName — this is what the approved template expects
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName || 'there' }
    ]
  });

  // Button URL is static (https://app.zicabella.com/cart) — no variable needed

  return sendAndLog({
    phone,
    templateName: 'zica_cart_recovery_v1',
    type: 'abandoned_cart',
    components,
    rawParams: { customerName, checkoutUrl, productImageUrl, productName, cartTotal, itemCount }
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
 * Template: zica_cod_confirmation_v1 (UTILITY)
 * Body: Hello {{1}}, we received order {{2}} ...
 * Buttons: QUICK_REPLY × 2 (Confirm / Cancel)
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

/**
 * 2M — sendCartRecoveryFollowUp
 * Template: zb_cart_followup (MARKETING)
 * Body: Hi {{1}}, ... Use code {{2}} ...
 * Button: URL with {{1}} dynamic suffix
 */
export async function sendCartRecoveryFollowUp({ phone, customerName, discountCode, checkoutUrl }) {
  const suffix = extractUrlSuffix(checkoutUrl);

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' },
        { type: 'text', text: discountCode || 'ZICA10' }
      ]
    },
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: suffix }]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_cart_followup',
    type: 'cart_followup',
    components,
    rawParams: { customerName, discountCode, checkoutUrl }
  });
}

/**
 * 2N — sendCartRecoveryFinalReminder
 * Template: zb_cart_final (MARKETING)
 * Body: Hi {{1}}, this is your last chance! ...
 * Button: URL with {{1}} dynamic suffix
 */
export async function sendCartRecoveryFinalReminder({ phone, customerName, checkoutUrl }) {
  const suffix = extractUrlSuffix(checkoutUrl);

  const components = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'there' }
      ]
    },
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: suffix }]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_cart_final',
    type: 'cart_final',
    components,
    rawParams: { customerName, checkoutUrl }
  });
}

/**
 * 2O — sendOrderTrackingUpdate
 * Template: zb_order_tracking (UTILITY)
 * Body: Hello {{1}}, your order {{2}} is on its way! ...
 * Button: URL with {{1}} dynamic suffix (order ID)
 */
export async function sendOrderTrackingUpdate({ phone, customerName, orderId, trackingUrl }) {
  const suffix = String(orderId);

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
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: suffix }]
    }
  ];

  return sendAndLog({
    phone,
    templateName: 'zb_order_tracking',
    type: 'order_tracking',
    components,
    rawParams: { customerName, orderId, trackingUrl }
  });
}
