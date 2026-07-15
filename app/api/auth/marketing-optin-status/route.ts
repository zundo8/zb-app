/**
 * Marketing Opt-In Status Query API
 * Location: app/api/auth/marketing-optin-status/route.ts
 *
 * Returns the current opt-in status for a given phone number.
 * Used by the login page to determine whether to show opt-in checkboxes
 * as interactive (first time) or locked (returning user).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const formatted = formatPhone(phone);
    if (!formatted || formatted.length < 10) {
      return NextResponse.json({
        whatsappOptedIn: false,
        emailOptedIn: false,
        hasOptedBefore: false,
      });
    }

    // Check WhatsApp opt-in status
    let whatsappOptedIn = false;
    let hasWhatsAppRecord = false;
    try {
      const waRecord = await prisma.whatsAppOptIn.findUnique({
        where: { phone: formatted },
      });
      if (waRecord) {
        hasWhatsAppRecord = true;
        whatsappOptedIn = waRecord.status === 'opted_in';
      }
    } catch (err) {
      // Non-critical
    }

    // Check Email opt-in status
    let emailOptedIn = false;
    let hasEmailRecord = false;
    try {
      const emailRecord = await prisma.emailOptIn.findUnique({
        where: { phone: formatted },
      });
      if (emailRecord) {
        hasEmailRecord = true;
        emailOptedIn = emailRecord.status === 'opted_in';
      }
    } catch (err) {
      // Non-critical
    }

    // Fallback: check Customer table if no dedicated records exist
    if (!hasWhatsAppRecord || !hasEmailRecord) {
      try {
        const customer = await prisma.customer.findFirst({
          where: {
            phone: { endsWith: formatted.slice(-10) },
          },
        });
        if (customer) {
          if (!hasWhatsAppRecord) {
            whatsappOptedIn = !customer.whatsappOptedOut;
          }
          if (!hasEmailRecord) {
            emailOptedIn = !customer.emailOptedOut;
          }
        }
      } catch (err) {
        // Non-critical
      }
    }

    const hasOptedBefore = hasWhatsAppRecord || hasEmailRecord;

    return NextResponse.json({
      whatsappOptedIn,
      emailOptedIn,
      hasOptedBefore,
    });
  } catch (error: any) {
    console.error('[Marketing OptIn Status] Error:', error);
    return NextResponse.json({
      whatsappOptedIn: false,
      emailOptedIn: false,
      hasOptedBefore: false,
    });
  }
}
