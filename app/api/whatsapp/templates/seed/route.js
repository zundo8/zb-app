/**
 * Pre-built Templates Seeder API Endpoint
 * Location: app/api/whatsapp/templates/seed/route.js
 */

import { NextResponse } from 'next/server';
import { createTemplate } from '@/lib/whatsapp/client';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const TEMPLATES_TO_SEED = [
  {
    name: 'zb_order_confirmed',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}! Your Zica Bella order #{{2}} for ₹{{3}} has been confirmed. We\'ll notify you when it ships. 🛍️'
      }
    ]
  },
  {
    name: 'zb_order_status',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}! Your Zica Bella order #{{2}} status has been updated to: *{{3}}*. {{4}}'
      }
    ]
  },
  {
    name: 'zb_order_shipped',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Great news, {{1}}! 📦 Your order #{{2}} is on its way.\nCourier: {{3}} | Tracking: {{4}}\nEstimated delivery: {{5}}'
      }
    ]
  },
  {
    name: 'zb_out_for_delivery',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Your Zica Bella order #{{1}} is out for delivery today! 🚚 Keep your phone handy, {{2}}.'
      }
    ]
  },
  {
    name: 'zb_order_delivered',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}! Your Zica Bella order #{{2}} has been delivered. We hope you love it! 💕\nNeed help? Reply here.'
      }
    ]
  },
  {
    name: 'zb_return_confirmed',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hi {{1}}, we\'ve received your return request for order #{{2}}. Your refund of ₹{{3}} will be processed within 5–7 business days.'
      }
    ]
  },
  {
    name: 'zb_abandoned_cart',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hey {{1}}! 👀 You left something behind.\n{{2}} item(s) worth ₹{{3}} are waiting in your cart.\nComplete your order before it sells out! 💃'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Complete Order',
            url: 'https://zicabella.com/checkout/recover/{{1}}'
          }
        ]
      }
    ]
  },
  {
    name: 'zb_new_collection',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE'
      },
      {
        type: 'BODY',
        text: '✨ New Drop Alert, {{1}}!\n*{{2}}* is now live on Zica Bella.\n{{3}}'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Shop Now',
            url: 'https://zicabella.com/{{1}}'
          }
        ]
      }
    ]
  },
  {
    name: 'zb_sale_alert',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: '🔥 {{1}}, the Zica Bella sale is LIVE!\nUp to {{2}}% off on selected styles.\nSale ends: {{3}}'
      }
    ]
  },
  {
    name: 'zb_restock_alert',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Good news, {{1}}! ✅\n*{{2}}* in size {{3}} is back in stock.\nGrab it before it\'s gone! 👉 zicabella.com'
      }
    ]
  },
  {
    name: 'zb_welcome',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Welcome to Zica Bella, {{1}}! 🌟\nYou\'re now part of our exclusive fashion circle.\nExplore our latest collections and enjoy a premium shopping experience.'
      }
    ]
  }
];

export async function POST() {
  let isConfigured = !!process.env.WHATSAPP_ACCESS_TOKEN;
  if (!isConfigured) {
    try {
      const shop = await prisma.shop.findFirst();
      if (shop?.whatsappToken) {
        isConfigured = true;
      }
    } catch (e) {}
  }

  if (!isConfigured) {
    return NextResponse.json(
      { error: 'WhatsApp not configured' },
      { status: 503 }
    );
  }

  const results = [];
  let successCount = 0;

  for (const template of TEMPLATES_TO_SEED) {
    try {
      const result = await createTemplate(template);
      results.push({
        name: template.name,
        status: 'submitted',
        result
      });
      successCount++;
    } catch (error) {
      console.error(`[WhatsApp Seeder] Failed to seed ${template.name}:`, error.message);
      results.push({
        name: template.name,
        status: 'error',
        error: error.message
      });
    }
  }

  return NextResponse.json({
    seeded: successCount,
    total: TEMPLATES_TO_SEED.length,
    results
  });
}
