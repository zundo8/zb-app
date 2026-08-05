/**
 * WhatsApp Chat Conversations List API Route
 * Location: app/api/whatsapp/chat/conversations/route.ts
 */

import { NextResponse } from 'next/server';
import prisma, { getPhoneLast10 } from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';
import { isValidName } from '@/lib/utils/customerName';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  conversations: any[];
  timestamp: number;
}

let conversationsCache: CacheEntry | null = null;
let isRefreshingCache = false;
const CACHE_TTL_MS = 20000; // 20 seconds TTL

async function fetchFreshConversations() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Fetch bounded recent messages to aggregate active conversations
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

    if (msg.direction === 'inbound' && msg.status !== 'read') {
      conversationMap[phone].unreadCount++;
    }

    if (msg.direction === 'inbound' && !conversationMap[phone].lastInboundCreatedAt) {
      conversationMap[phone].lastInboundCreatedAt = msg.createdAt;
    }
  }

  const conversations = Object.values(conversationMap);
  const phoneNumbers = conversations.map(c => c.phoneNumber);

  if (phoneNumbers.length > 0) {
    const last10Set = new Set(
      phoneNumbers
        .map(p => getPhoneLast10(p))
        .filter((p): p is string => p !== null && p.length === 10)
    );
    const last10List = Array.from(last10Set);

    if (last10List.length > 0) {
      // Fast, indexed equality lookups across Customer, WebStoreCustomer, WebStoreOrder, Address, Cart
      const [
        customers,
        webStoreCustomers,
        webStoreOrders,
        addresses,
        carts
      ] = await Promise.all([
        prisma.customer.findMany({
          where: {
            phoneLast10: { in: last10List }
          },
          select: {
            id: true,
            name: true,
            phone: true,
            phoneLast10: true,
            email: true,
            whatsappOptedOut: true,
            ordersCount: true,
            totalSpent: true,
          }
        }).catch(() => []),

        prisma.webStoreCustomer.findMany({
          where: {
            phoneLast10: { in: last10List }
          },
          select: { id: true, name: true, phone: true, phoneLast10: true, email: true }
        }).catch(() => []),

        prisma.webStoreOrder.findMany({
          where: {
            phoneLast10: { in: last10List }
          },
          select: { customerName: true, customerEmail: true, customerPhone: true, phoneLast10: true, totalAmount: true }
        }).catch(() => []),

        prisma.address.findMany({
          where: {
            phoneLast10: { in: last10List }
          },
          select: { name: true, phone: true, phoneLast10: true, email: true }
        }).catch(() => []),

        prisma.cart.findMany({
          where: {
            phoneLast10: { in: last10List }
          },
          select: {
            phone: true,
            phoneLast10: true,
            email: true,
            customer: { select: { name: true, phone: true, email: true } }
          }
        }).catch(() => [])
      ]);

      // Build fast in-memory lookup maps keyed by phoneLast10
      const customerByPhone = new Map<string, any>();
      const customerById = new Map<string, any>();
      for (const c of customers) {
        if (c.phoneLast10) customerByPhone.set(c.phoneLast10, c);
        if (c.id) customerById.set(c.id, c);
      }

      const webCustomerByPhone = new Map<string, any>();
      for (const wc of webStoreCustomers) {
        if (wc.phoneLast10) webCustomerByPhone.set(wc.phoneLast10, wc);
      }

      const addressByPhone = new Map<string, any>();
      for (const a of addresses) {
        if (a.phoneLast10) addressByPhone.set(a.phoneLast10, a);
      }

      const cartByPhone = new Map<string, any>();
      for (const ct of carts) {
        if (ct.phoneLast10) cartByPhone.set(ct.phoneLast10, ct);
      }

      const webStoreOrdersByPhone = new Map<string, { count: number; total: number; name?: string; email?: string }>();
      for (const wo of webStoreOrders) {
        if (!wo.phoneLast10) continue;
        const existing = webStoreOrdersByPhone.get(wo.phoneLast10) || { count: 0, total: 0 };
        existing.count++;
        existing.total += Number(wo.totalAmount || 0);
        if (!existing.name && isValidName(wo.customerName)) existing.name = wo.customerName.trim();
        if (!existing.email && wo.customerEmail) existing.email = wo.customerEmail;
        webStoreOrdersByPhone.set(wo.phoneLast10, existing);
      }

      // Map resolved customer details to conversations with O(1) lookups
      for (const conv of conversations) {
        const conv10 = getPhoneLast10(conv.phoneNumber);
        if (!conv10) continue;

        let matchedName: string | null = null;
        let matchedEmail: string | null = null;
        let matchedCustomerId: string | null = null;
        let matchedOptedOut = false;
        let computedOrdersCount = 0;
        let computedTotalSpent = 0;

        // 1. Customer table
        const matchedCustomer = customerByPhone.get(conv10) || (conv.customerId ? customerById.get(conv.customerId) : null);
        if (matchedCustomer) {
          if (isValidName(matchedCustomer.name)) matchedName = matchedCustomer.name.trim();
          if (matchedCustomer.email) matchedEmail = matchedCustomer.email;
          matchedCustomerId = matchedCustomer.id;
          matchedOptedOut = !!matchedCustomer.whatsappOptedOut;
          if (matchedCustomer.ordersCount) computedOrdersCount += matchedCustomer.ordersCount;
          if (matchedCustomer.totalSpent) computedTotalSpent += matchedCustomer.totalSpent;
        }

        // 2. WebStoreOrder table
        const woData = webStoreOrdersByPhone.get(conv10);
        if (woData) {
          computedOrdersCount += woData.count;
          computedTotalSpent += woData.total;
          if (!matchedName && woData.name) matchedName = woData.name;
          if (!matchedEmail && woData.email) matchedEmail = woData.email;
        }

        // 3. WebStoreCustomer table
        const matchedWebCust = webCustomerByPhone.get(conv10);
        if (matchedWebCust) {
          if (!matchedName && isValidName(matchedWebCust.name)) matchedName = matchedWebCust.name.trim();
          if (!matchedEmail && matchedWebCust.email) matchedEmail = matchedWebCust.email;
        }

        // 4. Cart table
        const matchedCart = cartByPhone.get(conv10);
        if (matchedCart) {
          if (!matchedName && isValidName(matchedCart.customer?.name)) matchedName = matchedCart.customer.name.trim();
          if (!matchedEmail) matchedEmail = matchedCart.email || matchedCart.customer?.email || null;
        }

        // 5. Address table
        const matchedAddress = addressByPhone.get(conv10);
        if (matchedAddress) {
          if (!matchedName && isValidName(matchedAddress.name)) matchedName = matchedAddress.name.trim();
          if (!matchedEmail && matchedAddress.email) matchedEmail = matchedAddress.email;
        }

        // Apply resolved properties
        if (matchedName) conv.customerName = matchedName;
        if (matchedEmail) conv.customerEmail = matchedEmail;
        if (matchedCustomerId) conv.customerId = matchedCustomerId;
        conv.whatsappOptedOut = matchedOptedOut;
        if (computedOrdersCount > 0) conv.ordersCount = computedOrdersCount;
        if (computedTotalSpent > 0) conv.totalSpent = Math.round(computedTotalSpent * 100) / 100;

        // NOTE: Write-amplification (prisma.customer.update inside read path loop) deleted.
      }
    }
  }

  // Sort conversations by latest message timestamp desc
  conversations.sort((a: any, b: any) =>
    new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
  );

  return conversations;
}

export async function GET() {
  const now = Date.now();

  // Return fresh cached data if within TTL
  if (conversationsCache && (now - conversationsCache.timestamp) < CACHE_TTL_MS) {
    return NextResponse.json({ conversations: conversationsCache.conversations });
  }

  // Stale-while-revalidate: return existing cache if background refresh is already running
  if (conversationsCache && isRefreshingCache) {
    return NextResponse.json({ conversations: conversationsCache.conversations });
  }

  isRefreshingCache = true;

  try {
    // Bounded execution timeout of 5 seconds to protect database pool
    const fetchPromise = fetchFreshConversations();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Conversations DB query timeout')), 5000)
    );

    const freshConversations = await Promise.race([fetchPromise, timeoutPromise]);

    conversationsCache = {
      conversations: freshConversations,
      timestamp: Date.now(),
    };

    return NextResponse.json({ conversations: freshConversations });
  } catch (error: any) {
    console.error('[WhatsApp Conversations API] GET error or timeout:', error?.message || error);

    // Fail safe: return last good cached conversations if available, or empty array (200 OK)
    if (conversationsCache) {
      return NextResponse.json({ conversations: conversationsCache.conversations });
    }
    return NextResponse.json({ conversations: [] }, { status: 200 });
  } finally {
    isRefreshingCache = false;
  }
}
