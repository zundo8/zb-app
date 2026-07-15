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

import { sendTemplate, formatPhone, uploadMediaFromUrl } from './client';
import { logMessage, getWhatsAppSetting } from './logger';
import prisma from '@/lib/db';

// ---------------------------------------------------------------------------
// Default product image used when no product-specific image is available
// ---------------------------------------------------------------------------
const FALLBACK_IMAGE_URL =
  'https://cdn.shopify.com/s/files/1/0955/5394/5881/files/zica-bella-logo_834c1ed2-2f09-4f73-bb9f-152a03f59ad2.png?v=1773354221';

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
// Helper: build dynamic components array for any Meta-approved template
// ---------------------------------------------------------------------------
async function buildDynamicComponents(templateName, defaultTemplate, eventType, data) {
  if (!templateName || templateName === defaultTemplate) {
    return null;
  }

  let template = null;
  try {
    template = await prisma.whatsAppTemplate.findUnique({
      where: { name: templateName }
    });
  } catch (e) {
    console.warn(`[WhatsApp Template Builder] DB lookup failed for template ${templateName}:`, e.message);
  }

  if (!template || !template.components) {
    return null;
  }

  const components = [];
  const metaComponents = Array.isArray(template.components) ? template.components : [];

  const headerComp = metaComponents.find(c => c && c.type === 'HEADER');
  const bodyComp = metaComponents.find(c => c && c.type === 'BODY');
  const buttonComp = metaComponents.find(c => c && c.type === 'BUTTONS');

  // 1. HEADER
  if (headerComp) {
    if (headerComp.format === 'IMAGE') {
      const imageUrl = resolveImageUrl(data.productImageUrl || data.imageUrl);
      let headerImageParam = null;
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) && !imageUrl.includes('localhost') && !imageUrl.includes('127.0.0.1')) {
        try {
          const mediaId = await uploadMediaFromUrl(imageUrl);
          if (mediaId) {
            headerImageParam = {
              type: 'image',
              image: { id: mediaId }
            };
          }
        } catch (err) {
          console.warn('[WhatsApp Template Builder] Media upload failed, falling back to link:', err.message);
        }
      }
      if (!headerImageParam) {
        headerImageParam = {
          type: 'image',
          image: { link: imageUrl }
        };
      }
      components.push({
        type: 'header',
        parameters: [headerImageParam]
      });
    } else if (headerComp.format === 'TEXT') {
      const text = headerComp.text || '';
      const hasVar = /\{\{1\}\}/.test(text);
      if (hasVar) {
        components.push({
          type: 'header',
          parameters: [
            { type: 'text', text: String(data.orderId || data.customerName || 'there') }
          ]
        });
      }
    }
  }

  // 2. BODY
  if (bodyComp) {
    const text = bodyComp.text || '';
    const regex = /\{\{(\d+)\}\}/g;
    const bodyVarsCount = (text.match(regex) || []).length;

    if (bodyVarsCount > 0) {
      const params = [];
      let defaultSeq = [];
      
      switch (eventType) {
        case 'order_confirmed':
        case 'order_delivered':
        case 'cod_confirmation':
          defaultSeq = [data.customerName, data.orderId];
          break;
        case 'order_shipped':
          defaultSeq = [data.customerName, data.orderId, data.trackingNumber];
          break;
        case 'order_status':
          defaultSeq = [data.customerName, data.orderId, data.status, data.extraInfo];
          break;
        case 'out_for_delivery':
          defaultSeq = [data.orderId, data.customerName];
          break;
        case 'return_confirmed':
          defaultSeq = [data.customerName, data.orderId, data.refundAmount];
          break;
        case 'abandoned_cart':
          defaultSeq = [data.customerName];
          break;
        case 'cart_followup':
          defaultSeq = [data.customerName, data.discountCode];
          break;
        case 'cart_final':
          defaultSeq = [data.customerName];
          break;
        default:
          defaultSeq = [data.customerName, data.orderId, data.productName];
      }

      for (let i = 0; i < bodyVarsCount; i++) {
        const val = defaultSeq[i] !== undefined ? defaultSeq[i] : '';
        params.push({ type: 'text', text: String(val || 'there') });
      }

      components.push({
        type: 'body',
        parameters: params
      });
    }
  }

  // 3. BUTTONS
  if (buttonComp && buttonComp.buttons) {
    buttonComp.buttons.forEach((btn, index) => {
      if (btn.type === 'URL' && btn.url && btn.url.includes('{{1}}')) {
        let suffix = 'cart';
        if (eventType === 'abandoned_cart') {
          suffix = data.productHandle || 'all';
        } else if (eventType === 'cart_followup' || eventType === 'cart_final') {
          suffix = extractUrlSuffix(data.checkoutUrl);
        } else if (eventType === 'order_tracking') {
          suffix = extractUrlSuffix(data.trackingUrl);
        } else {
          suffix = String(data.orderId || 'cart');
        }

        components.push({
          type: 'button',
          sub_type: 'url',
          index: index,
          parameters: [{ type: 'text', text: suffix }]
        });
      }
    });
  }

  return components;
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
 */
export async function sendOrderConfirmation({ phone, customerName, orderId, productImageUrl }) {
  const settingKey = 'template_order_confirmed';
  const defaultTemplate = 'zica_order_confirmed_v1';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'order_confirmed', {
    customerName,
    orderId,
    productImageUrl
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'order_confirmed',
      components: dynamicComponents,
      rawParams: { customerName, orderId, productImageUrl }
    });
  }

  // Fallback
  const components = [];
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

  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName || 'there' },
      { type: 'text', text: String(orderId) }
    ]
  });

  return sendAndLog({
    phone,
    templateName: defaultTemplate,
    type: 'order_confirmed',
    components,
    rawParams: { customerName, orderId, productImageUrl }
  });
}

/**
 * 2B — sendOrderStatus (Generic updates)
 * Template: zb_order_status (UTILITY)
 */
export async function sendOrderStatus({ phone, customerName, orderId, status, extraInfo }) {
  const settingKey = 'template_order_status';
  const defaultTemplate = 'zb_order_status';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'order_status', {
    customerName,
    orderId,
    status,
    extraInfo
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'order_status',
      components: dynamicComponents,
      rawParams: { customerName, orderId, status, extraInfo }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
    type: 'order_status',
    components,
    rawParams: { customerName, orderId, status, extraInfo }
  });
}

/**
 * 2C — sendShippingUpdate
 * Template: zica_order_shipped (UTILITY)
 */
export async function sendShippingUpdate({ phone, customerName, orderId, trackingNumber }) {
  const settingKey = 'template_order_shipped';
  const defaultTemplate = 'zica_order_shipped';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'order_shipped', {
    customerName,
    orderId,
    trackingNumber
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'order_shipped',
      components: dynamicComponents,
      rawParams: { customerName, orderId, trackingNumber }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
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
  const settingKey = 'template_out_for_delivery';
  const defaultTemplate = 'zb_out_for_delivery';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'out_for_delivery', {
    customerName,
    orderId
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'out_for_delivery',
      components: dynamicComponents,
      rawParams: { orderId, customerName }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
    type: 'out_for_delivery',
    components,
    rawParams: { orderId, customerName }
  });
}

/**
 * 2E — sendDelivered
 * Template: zica_order_delivered_v1 (MARKETING)
 */
export async function sendDelivered({ phone, customerName, orderId, productImageUrl }) {
  const settingKey = 'template_order_delivered';
  const defaultTemplate = 'zica_order_delivered_v1';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'order_delivered', {
    customerName,
    orderId,
    productImageUrl
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'order_delivered',
      components: dynamicComponents,
      rawParams: { customerName, orderId, productImageUrl }
    });
  }

  // Fallback
  const components = [];
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

  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName || 'there' },
      { type: 'text', text: String(orderId) }
    ]
  });

  return sendAndLog({
    phone,
    templateName: defaultTemplate,
    type: 'order_delivered',
    components,
    rawParams: { customerName, orderId, productImageUrl }
  });
}

/**
 * 2F — sendReturnConfirmed
 * Template: zb_return_confirmed (UTILITY)
 */
export async function sendReturnConfirmed({ phone, customerName, orderId, refundAmount }) {
  const settingKey = 'template_return_confirmed';
  const defaultTemplate = 'zb_return_confirmed';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'return_confirmed', {
    customerName,
    orderId,
    refundAmount
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'return_confirmed',
      components: dynamicComponents,
      rawParams: { customerName, orderId, refundAmount }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
    type: 'return_confirmed',
    components,
    rawParams: { customerName, orderId, refundAmount }
  });
}

/**
 * 2G — sendAbandonedCart
 * Template: zica_cart_recovery_v1 (MARKETING)
 */
export async function sendAbandonedCart({ phone, customerName, checkoutUrl, productImageUrl, productName, cartTotal, itemCount, productHandle }) {
  const settingKey = 'template_abandoned_cart';
  const defaultTemplate = 'zica_cart_recovery_v1';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  let resolvedImageUrl = productImageUrl;
  let resolvedName = productName;
  let resolvedTotal = cartTotal;
  let resolvedCount = itemCount;
  let resolvedHandle = productHandle;

  if ((!resolvedImageUrl || resolvedImageUrl === '' || !resolvedHandle) && checkoutUrl) {
    try {
      let cartId = null;
      if (checkoutUrl.includes('recover=')) {
        const match = checkoutUrl.match(/[?&]recover=([^&]+)/);
        if (match) cartId = match[1];
      } else {
        const urlObj = new URL(checkoutUrl);
        cartId = urlObj.searchParams.get('recover');
      }

      if (cartId) {
        const cart = await prisma.cart.findUnique({
          where: { id: cartId },
          include: { items: true }
        });
        if (cart && cart.items && cart.items.length > 0) {
          if (!resolvedImageUrl || resolvedImageUrl === '') {
            resolvedImageUrl = cart.items[0].image || '';
          }
          if (!resolvedName || resolvedName === '') {
            resolvedName = cart.items[0].title || '';
          }
          if (!resolvedTotal || resolvedTotal === '0.00') {
            resolvedTotal = String(cart.subtotal || '0.00');
          }
          if (!resolvedCount) {
            resolvedCount = cart.items.length;
          }
          if (!resolvedHandle) {
            resolvedHandle = cart.items[0].handle || '';
            
            // Fallback: if handle is not in cart item, check database Product table
            if (!resolvedHandle && cart.items[0].productId) {
              const dbProduct = await prisma.product.findUnique({
                where: { shopifyProductId: String(cart.items[0].productId) }
              });
              if (dbProduct && dbProduct.handle) {
                resolvedHandle = dbProduct.handle;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[WhatsApp sendAbandonedCart] Failed to resolve product info from database:', err.message);
    }
  }

  // Final fallbacks for resolvedHandle if still empty
  if (!resolvedHandle && resolvedName) {
    resolvedHandle = resolvedName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  if (!resolvedHandle) {
    resolvedHandle = 'all';
  }

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'abandoned_cart', {
    customerName,
    checkoutUrl,
    productImageUrl: resolvedImageUrl,
    productName: resolvedName,
    cartTotal: resolvedTotal,
    itemCount: resolvedCount,
    productHandle: resolvedHandle
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'abandoned_cart',
      components: dynamicComponents,
      rawParams: { customerName, checkoutUrl, productImageUrl: resolvedImageUrl, productName: resolvedName, cartTotal: resolvedTotal, itemCount: resolvedCount, productHandle: resolvedHandle }
    });
  }

  // Fallback
  const components = [];
  
  // Try to upload the product image to WhatsApp Media API
  let headerImageParam = null;
  if (resolvedImageUrl && (resolvedImageUrl.startsWith('http://') || resolvedImageUrl.startsWith('https://')) && !resolvedImageUrl.includes('localhost') && !resolvedImageUrl.includes('127.0.0.1')) {
    try {
      const mediaId = await uploadMediaFromUrl(resolvedImageUrl);
      if (mediaId) {
        headerImageParam = {
          type: 'image',
          image: { id: mediaId }
        };
      }
    } catch (err) {
      console.warn('[WhatsApp Template Sender] Failed to upload product image to WhatsApp Media API. Falling back to link:', err.message);
    }
  }

  if (!headerImageParam) {
    const imageUrl = resolveImageUrl(resolvedImageUrl);
    headerImageParam = {
      type: 'image',
      image: { link: imageUrl }
    };
  }

  components.push({
    type: 'header',
    parameters: [headerImageParam]
  });

  // Body: only {{1}} customerName — this is what the approved template expects
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: customerName || 'there' }
    ]
  });

  // Button URL is dynamic (https://app.zicabella.com/products/{{1}}) — pass the handle/slug
  components.push({
    type: 'button',
    sub_type: 'url',
    index: 0,
    parameters: [
      { type: 'text', text: resolvedHandle }
    ]
  });

  return sendAndLog({
    phone,
    templateName: defaultTemplate,
    type: 'abandoned_cart',
    components,
    rawParams: { customerName, checkoutUrl, productImageUrl: resolvedImageUrl, productName: resolvedName, cartTotal: resolvedTotal, itemCount: resolvedCount, productHandle: resolvedHandle }
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
 */
export async function sendCODConfirmation({ phone, customerName, orderId }) {
  const settingKey = 'template_cod_confirmation';
  const defaultTemplate = 'zica_cod_confirmation_v1';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'cod_confirmation', {
    customerName,
    orderId
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'cod_confirmation',
      components: dynamicComponents,
      rawParams: { customerName, orderId }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
    type: 'cod_confirmation',
    components,
    rawParams: { customerName, orderId }
  });
}

/**
 * 2M — sendCartRecoveryFollowUp
 * Template: zb_cart_followup (MARKETING)
 */
export async function sendCartRecoveryFollowUp({ phone, customerName, discountCode, checkoutUrl }) {
  const settingKey = 'template_cart_followup';
  const defaultTemplate = 'zb_cart_followup';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'cart_followup', {
    customerName,
    discountCode,
    checkoutUrl
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'cart_followup',
      components: dynamicComponents,
      rawParams: { customerName, discountCode, checkoutUrl }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
    type: 'cart_followup',
    components,
    rawParams: { customerName, discountCode, checkoutUrl }
  });
}

/**
 * 2N — sendCartRecoveryFinalReminder
 * Template: zb_cart_final (MARKETING)
 */
export async function sendCartRecoveryFinalReminder({ phone, customerName, checkoutUrl }) {
  const settingKey = 'template_cart_final';
  const defaultTemplate = 'zb_cart_final';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'cart_final', {
    customerName,
    checkoutUrl
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'cart_final',
      components: dynamicComponents,
      rawParams: { customerName, checkoutUrl }
    });
  }

  // Fallback
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
    templateName: defaultTemplate,
    type: 'cart_final',
    components,
    rawParams: { customerName, checkoutUrl }
  });
}

/**
 * 2O — sendOrderTrackingUpdate
 * Template: zb_order_tracking (UTILITY)
 */
export async function sendOrderTrackingUpdate({ phone, customerName, orderId, trackingUrl }) {
  const settingKey = 'template_order_tracking';
  const defaultTemplate = 'zb_order_tracking';
  const templateName = await getWhatsAppSetting(settingKey, defaultTemplate);

  const dynamicComponents = await buildDynamicComponents(templateName, defaultTemplate, 'order_tracking', {
    customerName,
    orderId,
    trackingUrl
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: 'order_tracking',
      components: dynamicComponents,
      rawParams: { customerName, orderId, trackingUrl }
    });
  }

  // Fallback
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

/**
 * sendCustomCartRecovery — Generic sender used by manual recovery triggers
 */
export async function sendCustomCartRecovery({ phone, customerName, checkoutUrl, templateName, productImageUrl, productName, cartTotal, itemCount, productHandle }) {
  let eventType = 'abandoned_cart';
  if (templateName.includes('followup') || templateName.includes('step2') || templateName === 'zb_cart_followup') {
    eventType = 'cart_followup';
  } else if (templateName.includes('final') || templateName.includes('step3') || templateName === 'zb_cart_final') {
    eventType = 'cart_final';
  }

  const dynamicComponents = await buildDynamicComponents(templateName, 'zica_cart_recovery_v1', eventType, {
    customerName,
    checkoutUrl,
    productImageUrl,
    productName,
    cartTotal,
    itemCount,
    productHandle,
    discountCode: 'ZICA10'
  });

  if (dynamicComponents !== null) {
    return sendAndLog({
      phone,
      templateName,
      type: eventType,
      components: dynamicComponents,
      rawParams: { customerName, checkoutUrl, productImageUrl, productName, cartTotal, itemCount, productHandle }
    });
  }

  // Fallback
  if (eventType === 'cart_followup') {
    return sendCartRecoveryFollowUp({ phone, customerName, discountCode: 'ZICA10', checkoutUrl });
  } else if (eventType === 'cart_final') {
    return sendCartRecoveryFinalReminder({ phone, customerName, checkoutUrl });
  } else {
    return sendAbandonedCart({ phone, customerName, checkoutUrl, productImageUrl, productName, cartTotal, itemCount, productHandle });
  }
}
