import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import { getAppAuthFromRequest } from '@/lib/appAuth';
import prisma from '@/lib/db';
import { allocateFailedOrderNumber } from '@/lib/order-utils';

const corsJsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsJsonHeaders,
  });
}

function razorpayErrMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { error?: { description?: string; code?: string }; message?: string };
    if (e.error?.description) return e.error.description;
    if (e.message) return e.message;
  }
  return 'Order creation failed';
}

async function resolveMobileCustomer(shopId: string, orderData: any, userAuth: NonNullable<ReturnType<typeof getAppAuthFromRequest>>) {
  const customerId = orderData?.customerId && orderData.customerId !== 'GUEST' ? orderData.customerId : userAuth.customerId;
  const customerEmail = orderData?.customerEmail || orderData?.shippingAddress?.email || userAuth.customerEmail;
  const customerPhone = orderData?.customerPhone || orderData?.shippingAddress?.phone || '';

  let customer = customerId
    ? await prisma.customer.findUnique({ where: { id: customerId } })
    : null;

  if (!customer && customerEmail) {
    customer = await prisma.customer.findFirst({ where: { email: customerEmail } });
  }

  if (!customer && customerPhone) {
    const phoneDigits = String(customerPhone).replace(/\D/g, '').slice(-10);
    if (phoneDigits.length === 10) {
      customer = await prisma.customer.findFirst({ where: { phone: { contains: phoneDigits } } });
    }
  }

  if (customer) return customer;

  const shippingAddress = orderData?.shippingAddress || {};
  return prisma.customer.create({
    data: {
      shopId,
      shopifyId: `GUEST_${Date.now()}`,
      name: shippingAddress.name || orderData?.customerName || 'Guest User',
      email: customerEmail || 'guest@zicabella.com',
      phone: customerPhone || '',
    },
  });
}

export async function POST(req: Request) {
  try {
    const userAuth = getAppAuthFromRequest(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401, headers: corsJsonHeaders });
    }

    let { key_id, key_secret, source } = await resolveRazorpayCredentials();
    key_id = key_id.trim();
    key_secret = key_secret.trim();
    
    const instance = new Razorpay({
      key_id,
      key_secret,
    });

    const body = await req.json();
    const { amount, currency = 'INR', receipt: receiptIn, orderData } = body;
    const amountRupees = Number(amount);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400, headers: corsJsonHeaders });
    }

    // Razorpay receipt: required, max 40 chars
    let receipt = typeof receiptIn === 'string' && receiptIn.trim() ? receiptIn.trim() : `zb_${Date.now()}`;
    if (receipt.length > 40) {
      receipt = receipt.slice(0, 40);
    }

    const order = await instance.orders.create({
      amount: Math.round(amountRupees * 100),
      currency,
      receipt,
      payment_capture: true,
      notes: {
        customerId: orderData?.customerId || userAuth.customerId,
        source: 'mobile-app'
      }
    });

    // ─── Create a PENDING order in our DB ───
    // This allows webhooks to find the order even if the app crashes/user leaves.
    if (orderData) {
      try {
        const shop = await prisma.shop.findFirst();
        if (shop) {
          const customer = await resolveMobileCustomer(shop.id, orderData, userAuth);
          const failedOrderNumber = await allocateFailedOrderNumber();
          await prisma.order.create({
            data: {
              shopId: shop.id,
              customerId: customer.id,
              shopifyOrderId: `#${failedOrderNumber}`,
              razorpayOrderId: order.id,
              totalPrice: amountRupees,
              subtotalPrice: orderData.subtotal || amountRupees,
              totalTax: 0,
              currency: 'INR',
              paymentStatus: 'pending',
              status: 'payment_pending',
              orderType: 'MOBILE_APP',
              fulfillmentStatus: 'unfulfilled',
              deliveryStatus: 'pending',
              paymentMethod: 'Razorpay',
              shippingAddress: typeof orderData.shippingAddress === 'string' ? orderData.shippingAddress : JSON.stringify({
                ...orderData.shippingAddress,
                address1: orderData.shippingAddress?.address1 || orderData.shippingAddress?.line1 || orderData.shippingAddress?.street || '',
                province: orderData.shippingAddress?.province || orderData.shippingAddress?.state || '',
                zip: orderData.shippingAddress?.zip || orderData.shippingAddress?.pincode || '',
              }),
              billingAddress: null,
              tags: orderData.tags || 'mobile-app, pending',
              note: orderData.note || 'Created via Payment Initiation',
              items: {
                create: await Promise.all((orderData.lineItems || []).map(async (li: any, idx: number) => {
                  let resolvedPid: string | null = null;
                  const rawPid = li.productId || li.product_id;
                  if (rawPid) {
                    const pidStr = String(rawPid);
                    const byId = await prisma.product.findUnique({ where: { id: pidStr }, select: { id: true } }).catch(() => null);
                    if (byId) {
                      resolvedPid = byId.id;
                    } else {
                      const { extractNumericId } = await import('@/lib/utils');
                      const numericPid = extractNumericId(pidStr);
                      if (numericPid) {
                        const byShopifyId = await prisma.product.findUnique({ where: { shopifyProductId: numericPid }, select: { id: true } }).catch(() => null);
                        if (byShopifyId) resolvedPid = byShopifyId.id;
                      }
                    }
                  }
                  
                  return {
                    shopifyLineItemId: `pending_${order.id}_${idx}`,
                    productId: resolvedPid,
                    title: li.name || li.title || 'Product',
                    quantity: Number(li.quantity || 1),
                    price: Number(li.price || 0),
                    sku: li.sku || null,
                    image: li.image || null,
                  };
                })),
              }
            }
          });
          console.log(`[Razorpay] Pre-created pending order ${order.id} in DB`);
        }
      } catch (dbErr: any) {
        console.warn('[Razorpay] Failed to pre-create pending order:', dbErr.message);
        // Non-blocking: we still want to return the Razorpay order_id
      }
    }

    return NextResponse.json(
      {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id,
      },
      { headers: corsJsonHeaders }
    );
  } catch (err: unknown) {
    console.error('Razorpay create-order error:', err);
    const message = err instanceof Error ? err.message : razorpayErrMessage(err);
    return NextResponse.json({ error: message }, { status: 500, headers: corsJsonHeaders });
  }
}
