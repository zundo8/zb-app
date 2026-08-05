import { NextRequest, NextResponse } from 'next/server';
import prisma, { getPhoneLast10 } from '@/lib/db';
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone parameter' }, { status: 400 });
    }

    const formatted = formatPhone(phone) || phone;
    const last10 = getPhoneLast10(phone);

    if (!last10 || last10.length !== 10) {
      return NextResponse.json({
        customerName: null,
        customerId: null,
        customerEmail: null,
        whatsappOptedOut: false,
        ordersCount: 0,
        totalSpent: 0
      });
    }

    // Run parallel targeted equality queries for single phone number using phoneLast10 index
    const [
      customers,
      webStoreCustomers,
      webStoreOrders,
      carts,
      addresses
    ] = await Promise.all([
      // 1. Customer table lookup (indexed)
      prisma.customer.findMany({
        where: {
          OR: [
            { phone: formatted },
            { phoneLast10: last10 }
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

      // 2. WebStoreCustomer table (indexed)
      prisma.webStoreCustomer.findMany({
        where: { phoneLast10: last10 },
        select: { id: true, name: true, phone: true, email: true }
      }).catch(() => []),

      // 3. WebStoreOrder table (indexed)
      prisma.webStoreOrder.findMany({
        where: { phoneLast10: last10 },
        select: { customerName: true, customerEmail: true, customerPhone: true, totalAmount: true }
      }).catch(() => []),

      // 4. Cart table (indexed)
      prisma.cart.findMany({
        where: { phoneLast10: last10 },
        select: {
          phone: true,
          email: true,
          customer: { select: { name: true, phone: true, email: true } }
        }
      }).catch(() => []),

      // 5. Address table (indexed)
      prisma.address.findMany({
        where: { phoneLast10: last10 },
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
      c.phoneLast10 === last10 || (c.phone && c.phone.replace(/\D/g, '').endsWith(last10))
    );

    if (matchedCustomer) {
      if (isValidName(matchedCustomer.name)) matchedName = matchedCustomer.name.trim();
      if (matchedCustomer.email) matchedEmail = matchedCustomer.email;
      matchedCustomerId = matchedCustomer.id;
      matchedOptedOut = !!matchedCustomer.whatsappOptedOut;
      if (matchedCustomer.ordersCount) computedOrdersCount += matchedCustomer.ordersCount;
      if (matchedCustomer.totalSpent) computedTotalSpent += matchedCustomer.totalSpent;
    }

    for (const wo of webStoreOrders) {
      computedOrdersCount++;
      computedTotalSpent += Number(wo.totalAmount || 0);
      if (!matchedName && isValidName(wo.customerName)) matchedName = wo.customerName.trim();
      if (!matchedEmail && wo.customerEmail) matchedEmail = wo.customerEmail;
    }

    const matchedWebCustomer = webStoreCustomers.find((wc: any) =>
      wc.phoneLast10 === last10 || (wc.phone && wc.phone.replace(/\D/g, '').endsWith(last10))
    );
    if (matchedWebCustomer) {
      if (!matchedName && isValidName(matchedWebCustomer.name)) matchedName = matchedWebCustomer.name.trim();
      if (!matchedEmail && matchedWebCustomer.email) matchedEmail = matchedWebCustomer.email;
    }

    const matchedCart = carts.find((ct: any) =>
      ct.phoneLast10 === last10 ||
      (ct.customer?.phone && ct.customer.phone.replace(/\D/g, '').endsWith(last10))
    );
    if (matchedCart) {
      if (!matchedName && isValidName(matchedCart.customer?.name)) matchedName = matchedCart.customer.name.trim();
      if (!matchedEmail) matchedEmail = matchedCart.email || matchedCart.customer?.email || null;
    }

    const matchedAddress = addresses.find((a: any) =>
      a.phoneLast10 === last10 || (a.phone && a.phone.replace(/\D/g, '').endsWith(last10))
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
