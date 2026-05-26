/**
 * WhatsApp Opted-in Recipients Fetch Endpoint
 * Location: app/api/whatsapp/recipients/route.js
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Query community members where whatsappOptIn is true
    const members = await prisma.communityMember.findMany({
      where: {
        whatsappOptIn: true
      },
      include: {
        customer: true
      }
    });

    // Map database models to standard recipient shapes
    const recipients = members
      .map(m => {
        const rawPhone = m.phone || m.customer?.phone || '';
        const name = m.customer?.name || 'Customer';
        return {
          phone: rawPhone,
          customerName: name
        };
      })
      .filter(r => r.phone);

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('[WhatsApp Recipients API] Error fetching opted-in customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
