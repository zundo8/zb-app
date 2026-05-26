/**
 * WhatsApp Cloud API Webhook Handler
 * Location: app/api/whatsapp/webhook/route.js
 */

import { NextResponse } from 'next/server';
import { markAsRead } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

/**
 * GET Handler — Meta webhook verification
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'zicabella_whatsapp_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    console.warn('[WhatsApp Webhook] Verification failed. Mode or Token mismatch.');
    return new Response('Forbidden', { status: 403 });
  } catch (error) {
    console.error('[WhatsApp Webhook] GET Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * POST Handler — Incoming messages and delivery status updates
 */
export async function POST(req) {
  try {
    const body = await req.json();

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Unsupported object type' }, { status: 400 });
    }

    // Process entries in background
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value;
          if (!value) continue;

          // Process incoming messages
          if (value.messages && Array.isArray(value.messages)) {
            for (const message of value.messages) {
              const from = message.from;
              const type = message.type;
              let text = '';

              if (type === 'text') {
                text = message.text?.body;
              } else if (type === 'button') {
                text = message.button?.text;
              } else if (type === 'interactive') {
                text = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
              }

              console.log('[WhatsApp Webhook] Received Message:', { from, type, text });

              // Call markAsRead in background and ignore failures
              markAsRead(message.id).catch(err => {
                console.error('[WhatsApp Webhook] Error marking message as read:', err.message);
              });
            }
          }

          // Process status updates (sent, delivered, read)
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const { id, recipient_id, status, timestamp } = statusObj;
              console.log('[WhatsApp Webhook] Received Status Update:', { id, recipient_id, status, timestamp });
            }
          }
        }
      }
    }

    // Always return 200 OK to Meta immediately
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[WhatsApp Webhook] POST Error:', error);
    // Meta requires 200 even on some processing errors to avoid retries clogging the pipe
    return new Response('OK', { status: 200 });
  }
}
