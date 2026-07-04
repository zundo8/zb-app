/**
 * WhatsApp Order Notifications Settings Toggle API Endpoint
 * Location: app/api/whatsapp/settings/route.js
 *
 * Handles both boolean toggle keys (e.g. order_confirmed = true/false)
 * and string template mapping keys (e.g. template_abandoned_cart = "zica_cart_recovery_v1").
 */

import { NextResponse } from 'next/server';
import { getWhatsAppSetting, setWhatsAppSetting } from '@/lib/whatsapp/logger';

export const dynamic = 'force-dynamic';

// Boolean toggle keys for enabling/disabling event notifications
const TOGGLE_KEYS = [
  'order_confirmed',
  'order_status',
  'order_shipped',
  'out_for_delivery',
  'order_delivered',
  'return_confirmed',
  'cart_recovery_enabled'
];

// String keys for template name mappings (admin can override which template
// is used for each event type)
const TEMPLATE_MAPPING_KEYS = [
  'template_order_confirmed',
  'template_order_shipped',
  'template_order_delivered',
  'template_abandoned_cart',
  'template_cart_followup',
  'template_cart_final',
  'template_order_tracking',
  'template_cod_confirmation',
];

const ALL_KEYS = [...TOGGLE_KEYS, ...TEMPLATE_MAPPING_KEYS];

/**
 * GET — Retrieve all order notification toggle settings + template mappings
 */
export async function GET() {
  try {
    const settings = {};
    // Load toggle keys (default to 'true')
    for (const key of TOGGLE_KEYS) {
      const val = await getWhatsAppSetting(key, 'true');
      settings[key] = val === 'true';
    }
    // Load template mapping keys (default to empty string = use built-in default)
    for (const key of TEMPLATE_MAPPING_KEYS) {
      const val = await getWhatsAppSetting(key, '');
      settings[key] = val;
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[WhatsApp Settings API] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Save/update order notification toggle settings + template mappings
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const updates = body.settings || body;

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Invalid settings body' }, { status: 400 });
    }

    for (const [key, val] of Object.entries(updates)) {
      if (!ALL_KEYS.includes(key)) continue;

      if (TOGGLE_KEYS.includes(key)) {
        // Boolean toggle
        await setWhatsAppSetting(key, val === true || val === 'true' ? 'true' : 'false');
      } else {
        // String template name
        await setWhatsAppSetting(key, String(val || ''));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Settings API] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
