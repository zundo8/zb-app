/**
 * WhatsApp Order Notifications Settings Toggle API Endpoint
 * Location: app/api/whatsapp/settings/route.js
 */

import { NextResponse } from 'next/server';
import { getWhatsAppSetting, setWhatsAppSetting } from '@/lib/whatsapp/logger';

export const dynamic = 'force-dynamic';

const TOGGLE_KEYS = [
  'order_confirmed',
  'order_status',
  'order_shipped',
  'out_for_delivery',
  'order_delivered',
  'return_confirmed',
  'cart_recovery_enabled'
];

/**
 * GET — Retrieve all order notification toggle settings
 */
export async function GET() {
  try {
    const settings = {};
    for (const key of TOGGLE_KEYS) {
      const val = await getWhatsAppSetting(key, 'true'); // default to true
      settings[key] = val === 'true';
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[WhatsApp Settings API] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Save/update order notification toggle settings
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const updates = body.settings || body;

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Invalid settings body' }, { status: 400 });
    }

    for (const [key, val] of Object.entries(updates)) {
      if (TOGGLE_KEYS.includes(key)) {
        await setWhatsAppSetting(key, val === true || val === 'true' ? 'true' : 'false');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Settings API] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
