/**
 * WhatsApp Chat Conversations List API Route
 * Location: app/api/whatsapp/chat/conversations/route.ts
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

function isValidName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  const lower = trimmed.toLowerCase();
  const genericNames = [
    'customer',
    'valued customer',
    'unregistered customer',
    'system',
    'there',
    'guest',
    'n/a',
    'unknown',
    'null',
    'undefined'
  ];
  return !genericNames.includes(lower);
}

function parseAddress(addrStr?: string | null) {
  if (!addrStr) return null;
  try {
    const parsed = JSON.parse(addrStr);
    if (typeof parsed === 'object' && parsed) {
      const name = parsed.name || (parsed.first_name ? `${parsed.first_name} ${parsed.last_name || ''}`.trim() : null);
      const phone = parsed.phone || null;
      const email = parsed.email || null;
      return { name, phone, email };
    }
  } catch (e) {}
  return null;
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch bounded recent messages to aggregate active conversations
    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
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
          customerId: msg.userId || null,
          customerEmail: null,
          whatsappOptedOut: false,
          lastInboundCreatedAt: null,
          ordersCount: 0,
          totalSpent: 0,
        };
      }

      // If inbound and not read, increment unread count
      if (msg.direction === 'inbound' && msg.status !== 'read') {
        conversationMap[phone].unreadCount++;
      }

      // Latest inbound timestamp
      if (msg.direction === 'inbound' && !conversationMap[phone].lastInboundCreatedAt) {
        conversationMap[phone].lastInboundCreatedAt = msg.createdAt;
      }
    }

    const conversations = Object.values(conversationMap);
    const phoneNumbers = conversations.map(c => c.phoneNumber);

    if (phoneNumbers.length > 0) {
      // 10-digit phone suffixes for indexed customer matching
      const last10Set = new Set(
        phoneNumbers
          .map(p => p.replace(/\D/g, '').slice(-10))
          .filter(p => p.length === 10)
      );
      const last10List = Array.from(last10Set);

      if (last10List.length > 0) {
        // Fast indexed lookup on Customer table only
        const customers = await prisma.customer.findMany({
          where: {
            OR: last10List.map(digit => ({
              phone: { contains: digit }
            }))
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            whatsappOptedOut: true,
            ordersCount: true,
            totalSpent: true,
          }
        }).catch(() => []);

        // Map resolved customer details to conversations
        for (const conv of conversations) {
          const conv10 = conv.phoneNumber.replace(/\D/g, '').slice(-10);
          if (!conv10) continue;

          const matchedCustomer = customers.find((c: any) =>
            (c.phone && c.phone.replace(/\D/g, '').endsWith(conv10)) ||
            (conv.customerId && c.id === conv.customerId)
          );

          if (matchedCustomer) {
            if (isValidName(matchedCustomer.name)) {
              conv.customerName = matchedCustomer.name.trim();
            }
            if (matchedCustomer.email) {
              conv.customerEmail = matchedCustomer.email;
            }
            conv.customerId = matchedCustomer.id;
            conv.whatsappOptedOut = !!matchedCustomer.whatsappOptedOut;
            conv.ordersCount = matchedCustomer.ordersCount || 0;
            conv.totalSpent = Math.round((matchedCustomer.totalSpent || 0) * 100) / 100;
          }
        }
      }
    }

    // Sort conversations by latest message timestamp desc
    conversations.sort((a: any, b: any) =>
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('[WhatsApp Conversations API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
