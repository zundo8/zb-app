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
      // 10-digit phone suffixes for matching
      const last10Set = new Set(
        phoneNumbers
          .map(p => p.replace(/\D/g, '').slice(-10))
          .filter(p => p.length === 10)
      );
      const last10List = Array.from(last10Set);

      if (last10List.length > 0) {
        // Query sources in parallel
        const [
          customers,
          webStoreCustomers,
          webStoreOrders,
          orders,
          carts,
          addresses
        ] = await Promise.all([
          // 1. Customer table
          prisma.customer.findMany({
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
              shopId: true,
            }
          }).catch(() => []),

          // 2. WebStoreCustomer table
          prisma.webStoreCustomer.findMany({
            where: {
              OR: last10List.map(digit => ({
                phone: { contains: digit }
              }))
            },
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          }).catch(() => []),

          // 3. WebStoreOrder table
          prisma.webStoreOrder.findMany({
            where: {
              OR: last10List.map(digit => ({
                customerPhone: { contains: digit }
              }))
            },
            select: {
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              totalAmount: true
            }
          }).catch(() => []),

          // 4. Order table
          prisma.order.findMany({
            where: {
              OR: last10List.flatMap(digit => [
                { customer: { phone: { contains: digit } } },
                { shippingAddress: { contains: digit } },
                { billingAddress: { contains: digit } }
              ])
            },
            select: {
              customerId: true,
              totalPrice: true,
              shippingAddress: true,
              billingAddress: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                  whatsappOptedOut: true,
                  ordersCount: true,
                  totalSpent: true
                }
              }
            }
          }).catch(() => []),

          // 5. Cart table
          prisma.cart.findMany({
            where: {
              OR: last10List.flatMap(digit => [
                { phone: { contains: digit } },
                { customer: { phone: { contains: digit } } }
              ])
            },
            select: {
              phone: true,
              email: true,
              customer: {
                select: {
                  name: true,
                  phone: true,
                  email: true
                }
              }
            }
          }).catch(() => []),

          // 6. Address table
          prisma.address.findMany({
            where: {
              OR: last10List.map(digit => ({
                phone: { contains: digit }
              }))
            },
            select: {
              name: true,
              phone: true,
              email: true
            }
          }).catch(() => [])
        ]);

        // Default shopId fallback for customer creation if needed
        let defaultShopId: string | null = null;
        if (customers.length > 0 && customers[0].shopId) {
          defaultShopId = customers[0].shopId;
        } else {
          const shop = await prisma.shop.findFirst({ select: { id: true } }).catch(() => null);
          defaultShopId = shop?.id || 'default_shop';
        }

        // Map data sources to conversations
        for (const conv of conversations) {
          const conv10 = conv.phoneNumber.replace(/\D/g, '').slice(-10);
          if (!conv10) continue;

          let matchedName: string | null = null;
          let matchedEmail: string | null = null;
          let matchedCustomerId: string | null = conv.customerId || null;
          let matchedOptedOut = false;
          let computedOrdersCount = 0;
          let computedTotalSpent = 0;

          // A) Check Customer table match
          const matchedCustomer = customers.find((c: any) =>
            (c.phone && c.phone.replace(/\D/g, '').endsWith(conv10)) ||
            (matchedCustomerId && c.id === matchedCustomerId)
          );

          if (matchedCustomer) {
            if (isValidName(matchedCustomer.name)) {
              matchedName = matchedCustomer.name.trim();
            }
            if (matchedCustomer.email) {
              matchedEmail = matchedCustomer.email;
            }
            matchedCustomerId = matchedCustomer.id;
            matchedOptedOut = !!matchedCustomer.whatsappOptedOut;
            if (matchedCustomer.ordersCount) computedOrdersCount += matchedCustomer.ordersCount;
            if (matchedCustomer.totalSpent) computedTotalSpent += matchedCustomer.totalSpent;
          }

          // B) Check Orders
          const matchingOrders = orders.filter((o: any) => {
            if (o.customer?.phone && o.customer.phone.replace(/\D/g, '').endsWith(conv10)) return true;
            if (o.shippingAddress && o.shippingAddress.includes(conv10)) return true;
            if (o.billingAddress && o.billingAddress.includes(conv10)) return true;
            return false;
          });

          for (const o of matchingOrders) {
            computedOrdersCount++;
            computedTotalSpent += Number(o.totalPrice || 0);

            if (!matchedName) {
              if (isValidName(o.customer?.name)) {
                matchedName = o.customer.name.trim();
              }
            }
            if (!matchedEmail && o.customer?.email) {
              matchedEmail = o.customer.email;
            }
            if (!matchedCustomerId && o.customer?.id) {
              matchedCustomerId = o.customer.id;
            }

            const parsedShip = parseAddress(o.shippingAddress);
            if (!matchedName && isValidName(parsedShip?.name)) {
              matchedName = parsedShip!.name!.trim();
            }
            if (!matchedEmail && parsedShip?.email) {
              matchedEmail = parsedShip.email;
            }
          }

          // C) Check WebStoreOrder table
          const matchingWebStoreOrders = webStoreOrders.filter((wo: any) =>
            wo.customerPhone && wo.customerPhone.replace(/\D/g, '').endsWith(conv10)
          );

          for (const wo of matchingWebStoreOrders) {
            computedOrdersCount++;
            computedTotalSpent += Number(wo.totalAmount || 0);

            if (!matchedName && isValidName(wo.customerName)) {
              matchedName = wo.customerName.trim();
            }
            if (!matchedEmail && wo.customerEmail) {
              matchedEmail = wo.customerEmail;
            }
          }

          // D) Check WebStoreCustomer table
          const matchedWebCustomer = webStoreCustomers.find((wc: any) =>
            wc.phone && wc.phone.replace(/\D/g, '').endsWith(conv10)
          );
          if (matchedWebCustomer) {
            if (!matchedName && isValidName(matchedWebCustomer.name)) {
              matchedName = matchedWebCustomer.name.trim();
            }
            if (!matchedEmail && matchedWebCustomer.email) {
              matchedEmail = matchedWebCustomer.email;
            }
          }

          // E) Check Cart table
          const matchedCart = carts.find((ct: any) =>
            (ct.phone && ct.phone.replace(/\D/g, '').endsWith(conv10)) ||
            (ct.customer?.phone && ct.customer.phone.replace(/\D/g, '').endsWith(conv10))
          );
          if (matchedCart) {
            if (!matchedName && isValidName(matchedCart.customer?.name)) {
              matchedName = matchedCart.customer.name.trim();
            }
            if (!matchedEmail) {
              matchedEmail = matchedCart.email || matchedCart.customer?.email || null;
            }
          }

          // F) Check Address table
          const matchedAddress = addresses.find((a: any) =>
            a.phone && a.phone.replace(/\D/g, '').endsWith(conv10)
          );
          if (matchedAddress) {
            if (!matchedName && isValidName(matchedAddress.name)) {
              matchedName = matchedAddress.name.trim();
            }
            if (!matchedEmail && matchedAddress.email) {
              matchedEmail = matchedAddress.email;
            }
          }

          // Auto-sync / create Customer record if customerId is missing so CRM features work reliably
          if (!matchedCustomerId && defaultShopId) {
            try {
              const newCust = await prisma.customer.create({
                data: {
                  shopId: defaultShopId,
                  name: matchedName || 'Customer',
                  phone: conv.phoneNumber,
                  email: matchedEmail || null,
                  shopifyId: `temp_chat_${Date.now()}_${conv10}`,
                  whatsappOptedOut: false,
                }
              });
              matchedCustomerId = newCust.id;
            } catch (createErr) {
              // Non-blocking catch if concurrent creation occurs
            }
          }

          // Assign resolved metadata to conversation object
          conv.customerName = matchedName;
          conv.customerId = matchedCustomerId;
          conv.customerEmail = matchedEmail;
          conv.whatsappOptedOut = matchedOptedOut;
          conv.ordersCount = computedOrdersCount;
          conv.totalSpent = Math.round(computedTotalSpent * 100) / 100;
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
