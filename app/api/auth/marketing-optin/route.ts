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

    // 1. Save WhatsApp consent to WhatsAppOptIn table
    await prisma.whatsAppOptIn.upsert({
      where: { phone: formatted },
      update: {
        status: whatsappOptIn ? 'opted_in' : 'opted_out',
        consentDate: now,
        source: 'webstore_login',
      },
      create: {
        phone: formatted,
        status: whatsappOptIn ? 'opted_in' : 'opted_out',
        consentDate: now,
        source: 'webstore_login',
      },
    });

    // 2. Save Email consent to EmailOptIn table
    await prisma.emailOptIn.upsert({
      where: { phone: formatted },
      update: {
        status: emailOptIn ? 'opted_in' : 'opted_out',
        consentDate: now,
        source: 'webstore_login',
      },
      create: {
        phone: formatted,
        status: emailOptIn ? 'opted_in' : 'opted_out',
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
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            whatsappOptedOut: !whatsappOptIn,
            emailOptedOut: !emailOptIn,
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
              data: { whatsappOptIn: whatsappOptIn },
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
