/**
 * WhatsApp Chat Conversations List API Route
 * Location: app/api/whatsapp/chat/conversations/route.ts
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch last 1000 messages to aggregate conversations in memory
    const messages = await prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const conversationMap: Record<string, any> = {};

    for (const msg of messages) {
      const phone = formatPhone(msg.phoneNumber) || msg.phoneNumber;
      if (!phone) continue;

      if (!conversationMap[phone]) {
        conversationMap[phone] = {
          phoneNumber: phone,
          lastMessage: {
            id: msg.id,
            body: msg.body,
            direction: msg.direction,
            status: msg.status,
            createdAt: msg.createdAt,
          },
          unreadCount: 0,
          customerName: null,
          customerId: msg.userId,
          lastInboundCreatedAt: null,
        };
      }

      // If inbound and not read, increment unread count
      if (msg.direction === 'inbound' && msg.status !== 'read') {
        conversationMap[phone].unreadCount++;
      }

      // Since messages are sorted by createdAt desc, the first inbound we find for a phone number is the latest inbound message
      if (msg.direction === 'inbound' && !conversationMap[phone].lastInboundCreatedAt) {
        conversationMap[phone].lastInboundCreatedAt = msg.createdAt;
      }
    }

    const conversations = Object.values(conversationMap);

    // Fetch matching customers to show actual names
    const phoneNumbers = conversations.map(c => c.phoneNumber);
    if (phoneNumbers.length > 0) {
      // Clean phones to match database format (usually contains last 10 digits)
      const last10Digits = phoneNumbers.map(p => p.slice(-10));
      
      const customers = await prisma.customer.findMany({
        where: {
          OR: last10Digits.map(digit => ({
            phone: { contains: digit }
          }))
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          whatsappOptedOut: true
        }
      });

      // Map customers to conversations
      for (const conv of conversations) {
        const conv10 = conv.phoneNumber.slice(-10);
        const match = customers.find((c: any) => c.phone && c.phone.replace(/\D/g, '').endsWith(conv10));
        if (match) {
          conv.customerName = match.name;
          conv.customerId = match.id;
          conv.customerEmail = match.email;
          conv.whatsappOptedOut = match.whatsappOptedOut;
        }
      }
    }

    // Sort by latest message timestamp desc
    conversations.sort((a: any, b: any) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('[WhatsApp Conversations API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
