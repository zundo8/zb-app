import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status, headers: corsHeaders });
}

function toOrderNumberFromSeq(seq: number) {
  return `ZB-${seq}`;
}

async function allocateOrderNumber(): Promise<string> {
  // Best-effort monotonic-ish allocation without schema changes.
  // We encode the orderNumber into Order.shopifyOrderId as `#${orderNumber}` for uniqueness.
  const count = await prisma.order.count();
  const base = 1000;
  // Avoid collisions by probing forward a bit.
  for (let i = 1; i <= 50; i++) {
    const candidate = toOrderNumberFromSeq(base + count + i);
    const existing = await prisma.order.findUnique({ where: { shopifyOrderId: `#${candidate}` }, select: { id: true } });
    if (!existing) return candidate;
  }
  // Fallback (should be extremely rare)
  return `ZB-${Date.now()}`;
}

export async function POST(req: Request) {
  // Try to get auth from request, but don't fail if missing (allows guest orders)
  const auth = getAppAuthFromRequest(req);

  try {
    const body = await req.json();

    // Map fields from different naming conventions
    const customerId = body.customerId || body.customer_id;
    const customerEmail = body.customerEmail || body.email;
    const customerPhone = body.customerPhone || body.phone;
    const shippingAddress = body.shippingAddress || body.shipping_address;
    const lineItems = body.lineItems || body.line_items;
    const paymentMethod = body.paymentMethod || body.payment_method;
    const paymentId = body.paymentId || body.payment_id;
    const paymentStatus = body.paymentStatus || body.financial_status || 'pending';
    const subtotal = Number(body.subtotal || body.subtotal_price || 0);
    const total = Number(body.total || body.total_price || 0);

    if (!customerEmail) return jsonError('customerEmail is required', 400);
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) return jsonError('lineItems is required', 400);

    const shop = await prisma.shop.findFirst();
    if (!shop) return jsonError('Shop not configured', 500);

    // Resolve or Create Customer
    let customer = null;
    if (customerId && customerId !== 'GUEST') {
      customer = await prisma.customer.findUnique({ where: { id: customerId } });
    }

    if (!customer && customerEmail) {
      customer = await prisma.customer.findFirst({ where: { email: customerEmail } });
    }

    if (!customer && customerPhone) {
      const phoneDigits = customerPhone.replace(/\D/g, '').slice(-10);
      if (phoneDigits.length === 10) {
        customer = await prisma.customer.findFirst({ where: { phone: { contains: phoneDigits } } });
      }
    }

    if (!customer) {
      // Create guest customer
      customer = await prisma.customer.create({
        data: {
          shopId: shop.id,
          shopifyId: `GUEST_${Date.now()}`,
          name: shippingAddress?.name || 'Guest User',
          email: customerEmail || 'guest@zicabella.com',
          phone: customerPhone || '',
        }
      });
    }

    const resolvedCustomerId = customer.id;
    const orderNumber = await allocateOrderNumber();
    const now = new Date();

    const tags = [
      'mobile-app',
      `zb-order-${orderNumber}`,
      paymentMethod === 'COD' ? 'cod' : 'prepaid',
    ].join(', ');

    const note = [
      `Mobile app order`,
      `InternalOrderId: pending`,
      `PaymentMethod: ${paymentMethod}`,
      paymentId ? `PaymentId: ${paymentId}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const created = await prisma.order.create({
      data: {
        shopId: shop.id,
        customerId: resolvedCustomerId,
        // Encode the human-readable order number here so we can keep schema unchanged.
        shopifyOrderId: `#${orderNumber}`,
        status: 'awaiting_approval',
        orderType: 'REGULAR',
        totalPrice: total,
        subtotalPrice: subtotal,
        totalTax: 0,
        currency: 'INR',
        paymentStatus,
        fulfillmentStatus: 'unfulfilled',
        deliveryStatus: 'pending',
        shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify({
          name: shippingAddress?.name || customer.name,
          line1: shippingAddress?.line1 || '',
          line2: shippingAddress?.line2 || '',
          city: shippingAddress?.city || '',
          state: shippingAddress?.state || '',
          pincode: shippingAddress?.pincode || '',
          country: shippingAddress?.country || 'India',
          phone: customerPhone || customer.phone,
          email: customerEmail || customer.email,
        }),
        billingAddress: null,
        note,
        tags,
        razorpayPaymentId: paymentId || null,
        paymentMethod: paymentMethod === 'COD' ? 'COD' : 'Razorpay',
        paymentCapturedAt: paymentStatus === 'paid' ? now : null,
        items: {
          create: lineItems.map((li: any, idx: number) => ({
            shopifyLineItemId: `app_${orderNumber}_${idx}`,
            productId: null,
            title: li.name || li.title || 'Product',
            quantity: Number(li.quantity || 0),
            price: Number(li.price || 0),
            sku: (li.variantId || li.variant_id) ? `variant:${String(li.variantId || li.variant_id)}` : null,
          })),
        },
        payments:
          paymentStatus === 'paid'
            ? {
                create: {
                  customerId: resolvedCustomerId,
                  amount: total,
                  type: 'INITIAL',
                  status: 'success',
                  gateway: paymentMethod === 'COD' ? 'cod' : 'razorpay',
                },
              }
            : undefined,
      },
      select: { id: true, shopifyOrderId: true, status: true },
    });

    // Internal "flag" for admin: tags + status ensure it shows up in admin Mobile App filter.

    return NextResponse.json({
      success: true,
      orderId: created.id,
      orderNumber,
      status: 'awaiting_approval',
      estimatedDelivery: null,
    }, { headers: corsHeaders });
  } catch (e: any) {
    console.error('[App API] orders/create error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
