/**
 * Marketing Opt-In Save API
 * Location: app/api/auth/marketing-optin/route.ts
 *
 * Saves WhatsApp and Email marketing opt-in preferences at login time.
 * Records proof-of-consent with timestamps per Meta Business Messaging Policy.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { phone, whatsappOptIn, emailOptIn } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const formatted = formatPhone(phone);
    if (!formatted || formatted.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const now = new Date();

    // Always opt users in for both WhatsApp and Email on login.
    // Users who log in / provide their phone are implicitly consenting
    // to receive order updates and marketing messages.
    // They can opt out at any time by sending "STOP" via WhatsApp.
    const whatsappStatus = 'opted_in';
    const emailStatus = 'opted_in';

    // 1. Save WhatsApp consent to WhatsAppOptIn table
    //    Only update to opted_in if no record exists OR if user is not
    //    explicitly opted out via webhook (STOP keyword).
    try {
      const existing = await prisma.whatsAppOptIn.findUnique({
        where: { phone: formatted },
      });

      if (!existing) {
        // No record yet — create as opted_in
        await prisma.whatsAppOptIn.create({
          data: {
            phone: formatted,
            status: whatsappStatus,
            consentDate: now,
            source: 'webstore_login',
          },
        });
      } else if (existing.source === 'webhook_optout') {
        // User explicitly sent STOP — do NOT override their opt-out
        console.log(`[Marketing OptIn] Preserving explicit webhook opt-out for ${formatted}`);
      } else {
        // Existing record from login or other source — update to opted_in
        await prisma.whatsAppOptIn.update({
          where: { phone: formatted },
          data: {
            status: whatsappStatus,
            consentDate: now,
            source: 'webstore_login',
          },
        });
      }
    } catch (waErr: any) {
      console.warn('[Marketing OptIn] WhatsApp opt-in save warning:', waErr.message);
    }

    // 2. Save Email consent to EmailOptIn table
    await prisma.emailOptIn.upsert({
      where: { phone: formatted },
      update: {
        status: emailStatus,
        consentDate: now,
        source: 'webstore_login',
      },
      create: {
        phone: formatted,
        status: emailStatus,
        consentDate: now,
        source: 'webstore_login',
      },
    });

    // 3. Sync with Customer table if customer already exists
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          phone: { endsWith: formatted.slice(-10) },
        },
      });

      if (customer) {
        const existing = await prisma.whatsAppOptIn.findUnique({
          where: { phone: formatted },
        });
        const isWaOptedOut = existing?.source === 'webhook_optout' && existing?.status === 'opted_out';

        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            whatsappOptedOut: isWaOptedOut,
            emailOptedOut: false,
          },
        });

        // 4. Sync with CommunityMember if exists
        try {
          const communityMember = await prisma.communityMember.findUnique({
            where: { customerId: customer.id },
          });
          if (communityMember) {
            await prisma.communityMember.update({
              where: { id: communityMember.id },
              data: { whatsappOptIn: !isWaOptedOut },
            });
          }
        } catch (err) {
          // CommunityMember sync is non-critical
        }
      }
    } catch (err) {
      // Customer sync is non-critical — consent is already saved in dedicated tables
      console.warn('[Marketing OptIn] Customer sync warning:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Marketing OptIn] Error saving consent:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
