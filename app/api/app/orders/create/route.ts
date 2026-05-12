import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';
import { createOrder, createCustomer } from '@/lib/shopify-admin';
import { extractNumericId } from '@/lib/utils';

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
    console.log('[App API] Order creation request body:', JSON.stringify(body).slice(0, 500));

    // Map fields from different naming conventions
    const customerId = body.customerId || body.customer_id;
    let customerEmail = body.customerEmail || body.email;
    const customerPhone = body.customerPhone || body.phone;
    const shippingAddress = body.shippingAddress || body.shipping_address;
    const lineItems = body.lineItems || body.line_items;
    const paymentMethod = (body.paymentMethod || body.payment_method || 'PREPAID').toUpperCase();
    const paymentId = body.paymentId || body.payment_id;
    const rzpOrderId = body.razorpayOrderId || body.razorpay_order_id;
    
    // Normalize payment status
    let paymentStatus = (body.paymentStatus || body.financial_status || 'pending').toLowerCase();
    if (paymentMethod === 'COD') {
      paymentStatus = 'pending';
    }

    const subtotal = Number(body.subtotal || body.subtotal_price || 0);
    const total = Number(body.total || body.total_price || 0);

    // Fallback to auth email if missing in body
    if (!customerEmail && auth?.customerEmail) {
      customerEmail = auth.customerEmail;
    }

    if (!customerEmail && !customerPhone) {
      return jsonError('Either customerEmail or customerPhone is required', 400);
    }
    
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return jsonError('lineItems is required and cannot be empty', 400);
    }

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
      const phoneDigits = String(customerPhone).replace(/\D/g, '').slice(-10);
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

    // Status: approved for paid, awaiting_approval for COD
    const initialStatus = paymentStatus === 'paid' ? 'OPEN' : 'awaiting_approval';
    
    // Check if order already exists (pre-created via initiate)
    let existingOrder = null;
    if (rzpOrderId) {
      existingOrder = await prisma.order.findUnique({
        where: { razorpayOrderId: rzpOrderId },
        include: { items: true }
      });
    }

    let finalShopifyOrderId = existingOrder?.shopifyOrderId || `#${orderNumber}`;
    let finalTags = existingOrder?.tags || tags;
    let isSyncedNow = false;

    // --- SHOPIFY SYNC FOR PAID OR COD (If we want COD in shopify too) ---
    // User requested: "paid orders should be synced and created and updated in shopify"
    // And "cod orders required an approval" -> usually COD synced AFTER approval, but some want it in Shopify as 'pending'
    
    const shouldSyncNow = (paymentStatus === 'paid') && (!existingOrder?.shopifyOrderId || existingOrder.shopifyOrderId.startsWith('#'));

    if (shouldSyncNow) {
        try {
            // Ensure customer exists in Shopify
            let shopifyCustomerId = customer.shopifyId;
            if (!shopifyCustomerId || shopifyCustomerId.startsWith('GUEST_') || shopifyCustomerId.startsWith('temp_')) {
                const nameParts = String(customer.name || 'App User').split(' ');
                try {
                  const createdCustomer = await createCustomer({
                      first_name: nameParts[0] || 'App',
                      last_name: nameParts.slice(1).join(' ') || 'User',
                      email: customer.email || `${Date.now()}@guest.zicabella.com`,
                      phone: customerPhone || customer.phone || '',
                      verified_email: true
                  });
                  shopifyCustomerId = String(createdCustomer.id);
                  await prisma.customer.update({ where: { id: customer.id }, data: { shopifyId: shopifyCustomerId } });
                } catch (ce: any) {
                  console.error('[App API] Customer creation failed:', ce.message);
                }
            }

            // Sync Order to Shopify
            const shopifyOrderPayload: any = {
                line_items: lineItems.map((li: any) => {
                    let vid = extractNumericId(li.variantId || li.variant_id);
                    if (!vid && typeof li.sku === 'string' && li.sku.startsWith('variant:')) {
                      vid = li.sku.split(':')[1];
                    }
                    return {
                        variant_id: vid ? parseInt(vid, 10) : null,
                        quantity: Number(li.quantity || 1),
                        title: li.name || li.title,
                        price: li.price ? String(li.price) : undefined,
                    };
                }).filter((li: any) => li.variant_id && !isNaN(li.variant_id)),
                financial_status: paymentStatus === 'paid' ? 'paid' : 'pending',
                tags: `${tags}, synced`,
                note: note,
                currency: 'INR',
                customer: shopifyCustomerId && !shopifyCustomerId.includes('GUEST') ? { id: parseInt(shopifyCustomerId, 10) } : undefined,
                shipping_address: {
                    first_name: shippingAddress?.first_name || shippingAddress?.name?.split(' ')[0] || customer.name?.split(' ')[0] || 'App',
                    last_name: shippingAddress?.last_name || shippingAddress?.name?.split(' ').slice(1).join(' ') || customer.name?.split(' ').slice(1).join(' ') || 'User',
                    address1: shippingAddress?.line1 || shippingAddress?.street || '',
                    address2: shippingAddress?.line2 || '',
                    city: shippingAddress?.city || '',
                    province: shippingAddress?.state || '',
                    zip: shippingAddress?.pincode || shippingAddress?.zip || '',
                    country: shippingAddress?.country || 'India',
                    phone: customerPhone || customer.phone || shippingAddress?.phone || '',
                },
                phone: customerPhone || customer.phone || shippingAddress?.phone || '',
            };
            shopifyOrderPayload.billing_address = shopifyOrderPayload.shipping_address;

            const shopifyOrderRes = await createOrder(shopifyOrderPayload);
            finalShopifyOrderId = String(shopifyOrderRes.id);
            finalTags = `${tags}, synced`;
            isSyncedNow = true;
            console.log(`[App API] Order synced to Shopify: ${finalShopifyOrderId}`);
        } catch (shopifyErr: any) {
            console.error('[App API] Shopify instant sync failed:', shopifyErr.message);
        }
    }

    if (existingOrder) {
      console.log(`[App API] Updating existing order ${existingOrder.id}...`);
      const updated = await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          shopifyOrderId: finalShopifyOrderId,
          status: initialStatus,
          paymentStatus,
          paymentMethod: paymentMethod === 'COD' ? 'COD' : 'Razorpay',
          razorpayPaymentId: paymentId || existingOrder.razorpayPaymentId || null,
          paymentCapturedAt: paymentStatus === 'paid' ? now : existingOrder.paymentCapturedAt,
          tags: finalTags,
          note: note,
          shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify({
            name: shippingAddress?.name || customer.name,
          address1: shippingAddress?.address1 || shippingAddress?.line1 || shippingAddress?.street || '',
          address2: shippingAddress?.address2 || shippingAddress?.line2 || '',
          city: shippingAddress?.city || '',
          province: shippingAddress?.province || shippingAddress?.state || '',
          zip: shippingAddress?.zip || shippingAddress?.pincode || '',
          country: shippingAddress?.country || 'India',
          phone: customerPhone || customer.phone || shippingAddress?.phone || '',
          email: customerEmail || customer.email || shippingAddress?.email || '',
        }),
        }
      });

      return NextResponse.json({
        success: true,
        orderId: updated.id,
        orderNumber: orderNumber,
        shopifyOrderId: isSyncedNow ? finalShopifyOrderId : updated.shopifyOrderId,
        status: updated.status,
      }, { headers: corsHeaders });
    }

    const created = await prisma.order.create({
      data: {
        shopId: shop.id,
        customerId: resolvedCustomerId,
        // Encode the human-readable order number here so we can keep schema unchanged.
        shopifyOrderId: finalShopifyOrderId,
        status: initialStatus,
        orderType: 'MOBILE_APP',
        totalPrice: total,
        subtotalPrice: subtotal,
        totalTax: 0,
        currency: 'INR',
        paymentStatus,
        razorpayOrderId: rzpOrderId,
        fulfillmentStatus: 'unfulfilled',
        deliveryStatus: 'pending',
        shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify({
          name: shippingAddress?.name || customer.name,
          address1: shippingAddress?.address1 || shippingAddress?.line1 || shippingAddress?.street || '',
          address2: shippingAddress?.address2 || shippingAddress?.line2 || '',
          city: shippingAddress?.city || '',
          province: shippingAddress?.province || shippingAddress?.state || '',
          zip: shippingAddress?.zip || shippingAddress?.pincode || '',
          country: shippingAddress?.country || 'India',
          phone: customerPhone || customer.phone || shippingAddress?.phone || '',
          email: customerEmail || customer.email || shippingAddress?.email || '',
        }),
        billingAddress: null,
        note,
        tags: finalTags,
        razorpayPaymentId: paymentId || null,
        paymentMethod: paymentMethod === 'COD' ? 'COD' : 'Razorpay',
        paymentCapturedAt: paymentStatus === 'paid' ? now : null,
        items: {
          create: await Promise.all(lineItems.map(async (li: any, idx: number) => {
            const rawPid = li.productId || li.product_id;
            const vid = extractNumericId(li.variantId || li.variant_id);
            
            let resolvedPid: string | null = null;
            if (rawPid) {
              const pidStr = String(rawPid);
              // Try finding by internal ID (CUID) first
              const byId = await prisma.product.findUnique({ where: { id: pidStr }, select: { id: true } });
              if (byId) {
                resolvedPid = byId.id;
              } else {
                // Try finding by Shopify ID
                const numericPid = extractNumericId(pidStr);
                if (numericPid) {
                  const byShopifyId = await prisma.product.findUnique({ where: { shopifyProductId: numericPid }, select: { id: true } });
                  if (byShopifyId) resolvedPid = byShopifyId.id;
                }
              }
            }

            return {
              shopifyLineItemId: `app_${orderNumber}_${idx}_${Date.now()}`,
              productId: resolvedPid,
              title: li.name || li.title || 'Product',
              quantity: Number(li.quantity || 0),
              price: Number(li.price || 0),
              sku: li.sku || (vid ? `variant:${vid}` : null),
              image: li.image || li.imageUrl || null,
            };
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

    return NextResponse.json({
      success: true,
      orderId: created.id,
      orderNumber,
      status: created.status,
      shopifyOrderId: isSyncedNow ? finalShopifyOrderId : created.shopifyOrderId,
    }, { headers: corsHeaders });
  } catch (e: any) {
    console.error('[App API] orders/create error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
