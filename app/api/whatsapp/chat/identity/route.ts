import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone parameter' }, { status: 400 });
    }

    const formatted = formatPhone(phone) || phone;
    const last10 = phone.replace(/\D/g, '').slice(-10);

    if (last10.length !== 10) {
      return NextResponse.json({
        customerName: null,
        customerId: null,
        customerEmail: null,
        whatsappOptedOut: false,
        ordersCount: 0,
        totalSpent: 0
      });
    }

    // Run parallel targeted queries for single phone number
    const [
      customers,
      webStoreCustomers,
      webStoreOrders,
      orders,
      carts,
      addresses
    ] = await Promise.all([
      // 1. Customer table lookup (indexed)
      prisma.customer.findMany({
        where: {
          OR: [
            { phone: formatted },
            { phone: { contains: last10 } }
          ]
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
        where: { phone: { contains: last10 } },
        select: { id: true, name: true, phone: true, email: true }
      }).catch(() => []),

      // 3. WebStoreOrder table
      prisma.webStoreOrder.findMany({
        where: { customerPhone: { contains: last10 } },
        select: { customerName: true, customerEmail: true, customerPhone: true, totalAmount: true }
      }).catch(() => []),

      // 4. Order table
      prisma.order.findMany({
        where: {
          OR: [
            { customer: { phone: { contains: last10 } } },
            { shippingAddress: { contains: last10 } },
            { billingAddress: { contains: last10 } }
          ]
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
          OR: [
            { phone: { contains: last10 } },
            { customer: { phone: { contains: last10 } } }
          ]
        },
        select: {
          phone: true,
          email: true,
          customer: { select: { name: true, phone: true, email: true } }
        }
      }).catch(() => []),

      // 6. Address table
      prisma.address.findMany({
        where: { phone: { contains: last10 } },
        select: { name: true, phone: true, email: true }
      }).catch(() => [])
    ]);

    let matchedName: string | null = null;
    let matchedEmail: string | null = null;
    let matchedCustomerId: string | null = null;
    let matchedOptedOut = false;
    let computedOrdersCount = 0;
    let computedTotalSpent = 0;

    const matchedCustomer = customers.find((c: any) =>
      (c.phone && c.phone.replace(/\D/g, '').endsWith(last10))
    );

    if (matchedCustomer) {
      if (isValidName(matchedCustomer.name)) matchedName = matchedCustomer.name.trim();
      if (matchedCustomer.email) matchedEmail = matchedCustomer.email;
      matchedCustomerId = matchedCustomer.id;
      matchedOptedOut = !!matchedCustomer.whatsappOptedOut;
      if (matchedCustomer.ordersCount) computedOrdersCount += matchedCustomer.ordersCount;
      if (matchedCustomer.totalSpent) computedTotalSpent += matchedCustomer.totalSpent;
    }

    for (const o of orders) {
      computedOrdersCount++;
      computedTotalSpent += Number(o.totalPrice || 0);

      if (!matchedName && isValidName(o.customer?.name)) matchedName = o.customer.name.trim();
      if (!matchedEmail && o.customer?.email) matchedEmail = o.customer.email;
      if (!matchedCustomerId && o.customer?.id) matchedCustomerId = o.customer.id;

      const parsedShip = parseAddress(o.shippingAddress);
      if (!matchedName && isValidName(parsedShip?.name)) matchedName = parsedShip!.name!.trim();
      if (!matchedEmail && parsedShip?.email) matchedEmail = parsedShip.email;
    }

    for (const wo of webStoreOrders) {
      computedOrdersCount++;
      computedTotalSpent += Number(wo.totalAmount || 0);
      if (!matchedName && isValidName(wo.customerName)) matchedName = wo.customerName.trim();
      if (!matchedEmail && wo.customerEmail) matchedEmail = wo.customerEmail;
    }

    const matchedWebCustomer = webStoreCustomers.find((wc: any) =>
      wc.phone && wc.phone.replace(/\D/g, '').endsWith(last10)
    );
    if (matchedWebCustomer) {
      if (!matchedName && isValidName(matchedWebCustomer.name)) matchedName = matchedWebCustomer.name.trim();
      if (!matchedEmail && matchedWebCustomer.email) matchedEmail = matchedWebCustomer.email;
    }

    const matchedCart = carts.find((ct: any) =>
      (ct.phone && ct.phone.replace(/\D/g, '').endsWith(last10)) ||
      (ct.customer?.phone && ct.customer.phone.replace(/\D/g, '').endsWith(last10))
    );
    if (matchedCart) {
      if (!matchedName && isValidName(matchedCart.customer?.name)) matchedName = matchedCart.customer.name.trim();
      if (!matchedEmail) matchedEmail = matchedCart.email || matchedCart.customer?.email || null;
    }

    const matchedAddress = addresses.find((a: any) =>
      a.phone && a.phone.replace(/\D/g, '').endsWith(last10)
    );
    if (matchedAddress) {
      if (!matchedName && isValidName(matchedAddress.name)) matchedName = matchedAddress.name.trim();
      if (!matchedEmail && matchedAddress.email) matchedEmail = matchedAddress.email;
    }

    return NextResponse.json({
      phoneNumber: formatted,
      customerName: matchedName,
      customerId: matchedCustomerId,
      customerEmail: matchedEmail,
      whatsappOptedOut: matchedOptedOut,
      ordersCount: computedOrdersCount,
      totalSpent: Math.round(computedTotalSpent * 100) / 100
    });
  } catch (error: any) {
    console.error('[WhatsApp Identity API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
