/**
 * WhatsApp JS Webhook Proxy
 * Delegates execution directly to the secure TS handler
 * Location: app/api/whatsapp/webhook/route.js
 */

import { GET as tsGET, POST as tsPOST } from '../../webhooks/whatsapp/route';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  return tsGET(req);
}

export async function POST(req) {
  return tsPOST(req);
}
