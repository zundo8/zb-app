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
  return `ZB${seq}`;
}

async function allocateOrderNumber(): Promise<string> {
  // Best-effort monotonic-ish allocation without schema changes.
  // Format: ZB71XXXX (e.g., ZB710001)
  const count = await prisma.order.count();
  const base = 710000;
  // Avoid collisions by probing forward a bit.
  for (let i = 1; i <= 100; i++) {
    const candidate = toOrderNumberFromSeq(base + count + i);
    // Check if any order already has this in shopifyOrderId (prefixed with #) or as a tag
    const existing = await prisma.order.findFirst({ 
      where: { 
        OR: [
          { shopifyOrderId: `#${candidate}` },
          { tags: { contains: candidate } }
        ]
      }, 
      select: { id: true } 
    });
    if (!existing) return candidate;
  }
  // Fallback
  return `ZB71${Math.floor(1000 + Math.random() * 9000)}`;
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
    const appliedStoreCredits = Number(body.appliedStoreCredits || 0);

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

    // ─── Store Credit Redemption ───
    if (appliedStoreCredits > 0) {
      if (customer.storeCredits < appliedStoreCredits) {
        return jsonError('Insufficient store credits balance', 400);
      }
    }

    const resolvedCustomerId = customer.id;
    const orderNumber = await allocateOrderNumber();
    const now = new Date();

    const tags = [
      'mobile-app',
      `zb-order-${orderNumber}`,
      paymentMethod === 'COD' ? 'cod' : 'prepaid',
      appliedStoreCredits > 0 ? 'store-credit-used' : null
    ].filter(Boolean).join(', ');

    const note = [
      `Mobile app order`,
      `InternalOrderId: pending`,
      `PaymentMethod: ${paymentMethod}`,
      appliedStoreCredits > 0 ? `Store Credits Used: ₹${appliedStoreCredits}` : null,
      paymentId ? `PaymentId: ${paymentId}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    // Status logic: 
    // 1. Paid -> OPEN (Auto-approved)
    // 2. COD -> awaiting_approval (Requires manual review)
    // 3. Unpaid Prepaid -> payment_pending (Abandoned/Failed flow)
    const initialStatus = paymentStatus === 'paid' 
      ? 'approved' 
      : paymentMethod === 'COD' 
        ? 'awaiting_approval' 
        : 'payment_pending';
    
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

            // Apply discount if credits used (as a custom line item or discount)
            if (appliedStoreCredits > 0) {
              shopifyOrderPayload.discount_codes = [
                { code: 'STORE_CREDIT', amount: String(appliedStoreCredits), type: 'fixed_amount' }
              ];
            }

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
      const updated = await prisma.$transaction(async (tx) => {
        // 1. Deduct credits if not already deducted
        if (appliedStoreCredits > 0) {
          await tx.customer.update({
            where: { id: customer!.id },
            data: { storeCredits: { decrement: appliedStoreCredits } }
          });
          await tx.storeCredit.create({
            data: {
              customerId: customer!.id,
              amount: -appliedStoreCredits,
              type: 'DEBIT',
              description: `Applied to order #${orderNumber}`,
              orderId: existingOrder!.id
            }
          });
        }

        return tx.order.update({
          where: { id: existingOrder!.id },
          data: {
            shopifyOrderId: finalShopifyOrderId,
            status: initialStatus,
            paymentStatus,
            paymentMethod: paymentMethod === 'COD' ? 'COD' : 'Razorpay',
            razorpayPaymentId: paymentId || existingOrder!.razorpayPaymentId || null,
            paymentCapturedAt: paymentStatus === 'paid' ? now : existingOrder!.paymentCapturedAt,
            tags: finalTags,
            note: note,
            shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify({
              name: shippingAddress?.name || customer!.name,
              address1: shippingAddress?.address1 || shippingAddress?.line1 || shippingAddress?.street || '',
              address2: shippingAddress?.address2 || shippingAddress?.line2 || '',
              city: shippingAddress?.city || '',
              province: shippingAddress?.province || shippingAddress?.state || '',
              zip: shippingAddress?.zip || shippingAddress?.pincode || '',
              country: shippingAddress?.country || 'India',
              phone: customerPhone || customer!.phone || shippingAddress?.phone || '',
              email: customerEmail || customer!.email || shippingAddress?.email || '',
            }),
          }
        });
      });

      return NextResponse.json({
        success: true,
        orderId: updated.id,
        orderNumber: orderNumber,
        shopifyOrderId: isSyncedNow ? finalShopifyOrderId : updated.shopifyOrderId,
        status: updated.status,
      }, { headers: corsHeaders });
    }

    const created = await prisma.$transaction(async (tx) => {
      // 1. Create order
      const order = await tx.order.create({
        data: {
          shopId: shop.id,
          customerId: resolvedCustomerId,
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
            name: shippingAddress?.name || customer!.name,
            address1: shippingAddress?.address1 || shippingAddress?.line1 || shippingAddress?.street || '',
            address2: shippingAddress?.address2 || shippingAddress?.line2 || '',
            city: shippingAddress?.city || '',
            province: shippingAddress?.province || shippingAddress?.state || '',
            zip: shippingAddress?.zip || shippingAddress?.pincode || '',
            country: shippingAddress?.country || 'India',
            phone: customerPhone || customer!.phone || shippingAddress?.phone || '',
            email: customerEmail || customer!.email || shippingAddress?.email || '',
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
                const byId = await tx.product.findUnique({ where: { id: pidStr }, select: { id: true } });
                if (byId) {
                  resolvedPid = byId.id;
                } else {
                  const numericPid = extractNumericId(pidStr);
                  if (numericPid) {
                    const byShopifyId = await tx.product.findUnique({ where: { shopifyProductId: numericPid }, select: { id: true } });
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
      });

      // 2. Deduct credits
      if (appliedStoreCredits > 0) {
        await tx.customer.update({
          where: { id: customer!.id },
          data: { storeCredits: { decrement: appliedStoreCredits } }
        });
        await tx.storeCredit.create({
          data: {
            customerId: customer!.id,
            amount: -appliedStoreCredits,
            type: 'DEBIT',
            description: `Applied to order #${orderNumber}`,
            orderId: order.id
          }
        });
      }

      return order;
    });

    // ─── Trigger Dynamic Order Confirmation Email ───
    if (customerEmail && (paymentStatus === 'paid' || paymentMethod === 'COD')) {
      try {
        const { sendMail } = await import('@/lib/mailer');
        const { orderConfirmationTemplate, renderDBTemplate } = await import('@/lib/email-templates');
        
        const customerName = shippingAddress?.name || customer?.name || 'Customer';
        const formattedItems = lineItems.map((item: any) => {
          let size = item.size || 'N/A';
          if (size === 'N/A' && item.name) {
            const sizeMatch = item.name.match(/\s*-\s*(XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i);
            if (sizeMatch) size = sizeMatch[1].toUpperCase();
          }
          return {
            name: item.name || item.title || 'Product',
            size: size,
            qty: item.quantity || 1,
            price: `INR ${item.price || 0}`,
          };
        });

        const itemsHtml = formattedItems
          .map(
            (item: any) => `
          <div class="product-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
            <div style="flex: 1;">
              <div style="font-weight: 600;">${item.name}</div>
              <div style="font-size: 13px; color: #888888;">Size: ${item.size} × ${item.qty}</div>
            </div>
            <div style="font-weight: 600;">${item.price}</div>
          </div>
        `
          )
          .join('');

        const emailVars = {
          customerName,
          orderId: created.shopifyOrderId || created.id,
          orderDate: new Date(created.createdAt).toLocaleDateString(),
          itemsHtml,
          items: itemsHtml, // support both variable mappings
          subtotal: `INR ${subtotal}`,
          shipping: `INR ${paymentMethod === 'COD' ? 99 : 0}`,
          total: `INR ${total}`,
          shippingAddress: typeof shippingAddress === 'string' ? shippingAddress : `${shippingAddress?.line1 || shippingAddress?.street || ''}, ${shippingAddress?.city || ''}, ${shippingAddress?.state || ''} - ${shippingAddress?.pincode || shippingAddress?.zip || ''}, ${shippingAddress?.country || 'India'}`,
          orderStatusUrl: `https://zicabella.com/account/orders`,
        };

        const fallbackFn = () => orderConfirmationTemplate({
          customerName,
          orderId: created.shopifyOrderId || created.id,
          orderDate: new Date(created.createdAt).toLocaleDateString(),
          items: formattedItems,
          subtotal: `INR ${subtotal}`,
          shipping: `INR ${paymentMethod === 'COD' ? 99 : 0}`,
          total: `INR ${total}`,
          shippingAddress: emailVars.shippingAddress,
        });

        const rendered = await renderDBTemplate('ORDER_CONFIRMATION', emailVars, fallbackFn);

        const emailResult = await sendMail({
          to: customerEmail,
          subject: rendered.subject || `Order Confirmed - ${created.shopifyOrderId || created.id}`,
          html: rendered.html,
        });

        await prisma.emailLog.create({
          data: {
            recipientEmail: customerEmail,
            recipientName: customerName,
            subject: rendered.subject || `Order Confirmed - ${created.shopifyOrderId || created.id}`,
            templateName: 'Order Confirmed',
            triggerEvent: 'app/orders/create',
            referenceId: created.id,
            status: emailResult.messageId ? 'sent' : 'failed',
            messageId: emailResult.messageId || null,
            sentBy: 'system',
          }
        });
      } catch (emailErr: any) {
        console.error('[Email Trigger Error] Failed to send order confirmation email:', emailErr.message);
      }
    }

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
