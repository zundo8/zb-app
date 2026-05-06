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
  // Validate auth token
  const auth = getAppAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      customerId,
      customerEmail,
      customerPhone,
      shippingAddress,
      lineItems,
      paymentMethod,
      paymentId,
      paymentStatus,
      subtotal,
      deliveryFee,
      total,
    } = body || {};

    if (!customerId || typeof customerId !== 'string') return jsonError('customerId is required', 400);

    // Validate that the authenticated user matches the customer placing the order
    if (customerId !== auth.customerId) {
      return NextResponse.json({ error: 'Unauthorized: customer mismatch' }, { status: 403, headers: corsHeaders });
    }

    if (!customerEmail || typeof customerEmail !== 'string') return jsonError('customerEmail is required', 400);
    if (!customerPhone || typeof customerPhone !== 'string') return jsonError('customerPhone is required', 400);

    if (!shippingAddress || typeof shippingAddress !== 'object') return jsonError('shippingAddress is required', 400);
    if (!Array.isArray(lineItems) || lineItems.length === 0) return jsonError('lineItems is required', 400);

    if (paymentMethod !== 'COD' && paymentMethod !== 'PREPAID') return jsonError('paymentMethod must be COD or PREPAID', 400);
    if (paymentStatus !== 'pending' && paymentStatus !== 'paid') return jsonError('paymentStatus must be pending or paid', 400);
    if (paymentMethod === 'PREPAID' && (!paymentId || typeof paymentId !== 'string')) {
      return jsonError('paymentId is required for PREPAID orders', 400);
    }

    const shop = await prisma.shop.findFirst();
    if (!shop) return jsonError('Shop not configured', 500);

    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) return jsonError('Customer not found', 404);

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
        customerId,
        // Encode the human-readable order number here so we can keep schema unchanged.
        // This is NOT the Shopify order id; Shopify sync happens later from admin.
        shopifyOrderId: `#${orderNumber}`,
        status: 'awaiting_approval',
        orderType: 'REGULAR',
        totalPrice: Number(total || 0),
        subtotalPrice: Number(subtotal || 0),
        totalTax: 0,
        currency: 'INR',
        paymentStatus,
        fulfillmentStatus: 'unfulfilled',
        deliveryStatus: 'pending',
        shippingAddress: JSON.stringify({
          name: shippingAddress.name,
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode,
          country: 'India',
          phone: customerPhone,
          email: customerEmail,
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
            // Important: cart `productId`/`variantId` in the mobile app are Shopify IDs.
            // We keep prisma.productId nullable and encode variant id into sku for admin Shopify sync.
            productId: null,
            title: `${li.name}${li.size ? ` - ${li.size}` : ''}`.trim(),
            quantity: Number(li.quantity || 0),
            price: Number(li.price || 0),
            sku: li?.variantId ? `variant:${String(li.variantId)}` : null,
          })),
        },
        payments:
          paymentStatus === 'paid'
            ? {
                create: {
                  customerId,
                  amount: Number(total || 0),
                  type: 'INITIAL',
                  status: 'success',
                  gateway: 'razorpay',
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
