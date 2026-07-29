/**
 * WhatsApp Chat Conversations List API Route
 * Location: app/api/whatsapp/chat/conversations/route.ts
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhone } from '@/lib/whatsapp/client';
import { isValidName } from '@/lib/utils/customerName';

export const dynamic = 'force-dynamic';

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
        // Fast parallel lookup across Customer, WebStoreCustomer, WebStoreOrder, Order, Cart, Address tables
        const [
          customers,
          webStoreCustomers,
          webStoreOrders,
          orders,
          carts,
          addresses
        ] = await Promise.all([
          prisma.customer.findMany({
            where: {
              OR: last10List.map(digit => ({ phone: { contains: digit } }))
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
          }).catch(() => []),

          prisma.webStoreCustomer.findMany({
            where: {
              OR: last10List.map(digit => ({ phone: { contains: digit } }))
            },
            select: { id: true, name: true, phone: true, email: true }
          }).catch(() => []),

          prisma.webStoreOrder.findMany({
            where: {
              OR: last10List.map(digit => ({ customerPhone: { contains: digit } }))
            },
            select: { customerName: true, customerEmail: true, customerPhone: true, totalAmount: true }
          }).catch(() => []),

          prisma.order.findMany({
            where: {
              OR: [
                ...last10List.map(digit => ({ customer: { phone: { contains: digit } } })),
                ...last10List.map(digit => ({ shippingAddress: { contains: digit } })),
                ...last10List.map(digit => ({ billingAddress: { contains: digit } }))
              ]
            },
            select: {
              customerId: true,
              totalPrice: true,
              shippingAddress: true,
              billingAddress: true,
              customer: {
                select: { id: true, name: true, phone: true, email: true }
              }
            }
          }).catch(() => []),

          prisma.cart.findMany({
            where: {
              OR: [
                ...last10List.map(digit => ({ phone: { contains: digit } })),
                ...last10List.map(digit => ({ customer: { phone: { contains: digit } } }))
              ]
            },
            select: {
              phone: true,
              email: true,
              customer: { select: { name: true, phone: true, email: true } }
            }
          }).catch(() => []),

          prisma.address.findMany({
            where: {
              OR: last10List.map(digit => ({ phone: { contains: digit } }))
            },
            select: { name: true, phone: true, email: true }
          }).catch(() => [])
        ]);

        // Map resolved customer details to conversations
        for (const conv of conversations) {
          const conv10 = conv.phoneNumber.replace(/\D/g, '').slice(-10);
          if (!conv10) continue;

          let matchedName: string | null = null;
          let matchedEmail: string | null = null;
          let matchedCustomerId: string | null = null;
          let matchedOptedOut = false;
          let computedOrdersCount = 0;
          let computedTotalSpent = 0;

          // 1. Customer table
          const matchedCustomer = customers.find((c: any) =>
            (c.phone && c.phone.replace(/\D/g, '').endsWith(conv10)) ||
            (conv.customerId && c.id === conv.customerId)
          );

          if (matchedCustomer) {
            if (isValidName(matchedCustomer.name)) matchedName = matchedCustomer.name.trim();
            if (matchedCustomer.email) matchedEmail = matchedCustomer.email;
            matchedCustomerId = matchedCustomer.id;
            matchedOptedOut = !!matchedCustomer.whatsappOptedOut;
            if (matchedCustomer.ordersCount) computedOrdersCount += matchedCustomer.ordersCount;
            if (matchedCustomer.totalSpent) computedTotalSpent += matchedCustomer.totalSpent;
          }

          // 2. Order table
          for (const o of orders) {
            const oPhone = o.customer?.phone || '';
            const isMatch = (oPhone && oPhone.replace(/\D/g, '').endsWith(conv10)) ||
              (o.shippingAddress && o.shippingAddress.includes(conv10)) ||
              (o.billingAddress && o.billingAddress.includes(conv10));

            if (isMatch) {
              computedOrdersCount++;
              computedTotalSpent += Number(o.totalPrice || 0);

              if (!matchedName && isValidName(o.customer?.name)) matchedName = o.customer.name.trim();
              if (!matchedEmail && o.customer?.email) matchedEmail = o.customer.email;
              if (!matchedCustomerId && o.customer?.id) matchedCustomerId = o.customer.id;

              const parsedShip = parseAddress(o.shippingAddress);
              if (!matchedName && isValidName(parsedShip?.name)) matchedName = parsedShip!.name!.trim();
              if (!matchedEmail && parsedShip?.email) matchedEmail = parsedShip.email;
            }
          }

          // 3. WebStoreOrder table
          for (const wo of webStoreOrders) {
            if (wo.customerPhone && wo.customerPhone.replace(/\D/g, '').endsWith(conv10)) {
              computedOrdersCount++;
              computedTotalSpent += Number(wo.totalAmount || 0);
              if (!matchedName && isValidName(wo.customerName)) matchedName = wo.customerName.trim();
              if (!matchedEmail && wo.customerEmail) matchedEmail = wo.customerEmail;
            }
          }

          // 4. WebStoreCustomer table
          const matchedWebCust = webStoreCustomers.find((wc: any) =>
            wc.phone && wc.phone.replace(/\D/g, '').endsWith(conv10)
          );
          if (matchedWebCust) {
            if (!matchedName && isValidName(matchedWebCust.name)) matchedName = matchedWebCust.name.trim();
            if (!matchedEmail && matchedWebCust.email) matchedEmail = matchedWebCust.email;
          }

          // 5. Cart table
          const matchedCart = carts.find((ct: any) =>
            (ct.phone && ct.phone.replace(/\D/g, '').endsWith(conv10)) ||
            (ct.customer?.phone && ct.customer.phone.replace(/\D/g, '').endsWith(conv10))
          );
          if (matchedCart) {
            if (!matchedName && isValidName(matchedCart.customer?.name)) matchedName = matchedCart.customer.name.trim();
            if (!matchedEmail) matchedEmail = matchedCart.email || matchedCart.customer?.email || null;
          }

          // 6. Address table
          const matchedAddress = addresses.find((a: any) =>
            a.phone && a.phone.replace(/\D/g, '').endsWith(conv10)
          );
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

          // Auto-sync name back to customer table if missing
          if (matchedCustomerId && matchedName && (!matchedCustomer?.name || !isValidName(matchedCustomer.name))) {
            prisma.customer.update({
              where: { id: matchedCustomerId },
              data: { name: matchedName }
            }).catch(() => {});
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
