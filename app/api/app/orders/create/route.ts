import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';
import { createOrder, createCustomer } from '@/lib/shopify-admin';
import { extractNumericId } from '@/lib/utils';
import { allocateOrderNumber } from '@/lib/order-utils';

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

    const orderNumber = await allocateOrderNumber();

    // ─── Store Credit Redemption ───
    if (appliedStoreCredits > 0) {
      try {
        const { debitStoreCredits } = await import('@/lib/storeCreditsHelper');
        await debitStoreCredits(customer.id, appliedStoreCredits, `#${orderNumber}`);
      } catch (debitErr: any) {
        return jsonError(debitErr.message, 400);
      }
    }

    const resolvedCustomerId = customer.id;
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
        // Also update or create corresponding MobileOrder record
        const mobileOrder = await tx.mobileOrder.findUnique({
          where: { orderNumber: orderNumber }
        });

        const mobileOrderData = {
          shopifyOrderId: finalShopifyOrderId,
          status: isSyncedNow ? 'synced' : initialStatus,
          paymentStatus,
          paymentMethod: paymentMethod === 'COD' ? 'COD' : 'PREPAID',
          paymentId: paymentId || null,
          syncedAt: isSyncedNow ? now : null,
          tags: finalTags,
        };

        if (mobileOrder) {
          await tx.mobileOrder.update({
            where: { id: mobileOrder.id },
            data: mobileOrderData
          });
        } else {
          const mobileOrderItems = await Promise.all(lineItems.map(async (li: any) => {
            const rawPid = li.productId || li.product_id;
            const vid = extractNumericId(li.variantId || li.variant_id);
            
            let resolvedPid: string | null = null;
            if (rawPid) {
              const pidStr = String(rawPid);
              const byId = await tx.product.findUnique({ where: { id: pidStr }, select: { id: true } });
              if (byId) resolvedPid = byId.id;
            }

            return {
              productId: resolvedPid,
              title: li.name || li.title || 'Product',
              quantity: Number(li.quantity || 0),
              price: Number(li.price || 0),
              sku: li.sku || (vid ? `variant:${vid}` : null),
              image: li.image || li.imageUrl || null,
            };
          }));

          await tx.mobileOrder.create({
            data: {
              orderNumber: orderNumber,
              shopifyOrderId: finalShopifyOrderId,
              customerId: resolvedCustomerId,
              status: isSyncedNow ? 'synced' : initialStatus,
              paymentStatus,
              paymentMethod: paymentMethod === 'COD' ? 'COD' : 'PREPAID',
              paymentId: paymentId || null,
              totalPrice: total,
              subtotalPrice: subtotal,
              totalTax: 0,
              discountAmount: appliedStoreCredits,
              discountCode: appliedStoreCredits > 0 ? 'STORE_CREDIT' : null,
              currency: 'INR',
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
              source: 'mobile_app',
              createdAt: now,
              syncedAt: isSyncedNow ? now : null,
              items: {
                create: mobileOrderItems
              }
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

      // Also create MobileOrder and MobileOrderItem records
      const mobileOrderItems = await Promise.all(lineItems.map(async (li: any) => {
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
          productId: resolvedPid,
          title: li.name || li.title || 'Product',
          quantity: Number(li.quantity || 0),
          price: Number(li.price || 0),
          sku: li.sku || (vid ? `variant:${vid}` : null),
          image: li.image || li.imageUrl || null,
        };
      }));

      await tx.mobileOrder.create({
        data: {
          orderNumber: orderNumber,
          shopifyOrderId: isSyncedNow ? finalShopifyOrderId : null,
          customerId: resolvedCustomerId,
          status: isSyncedNow ? 'synced' : initialStatus,
          paymentStatus,
          paymentMethod: paymentMethod === 'COD' ? 'COD' : 'PREPAID',
          paymentId: paymentId || null,
          totalPrice: total,
          subtotalPrice: subtotal,
          totalTax: 0,
          discountAmount: appliedStoreCredits,
          discountCode: appliedStoreCredits > 0 ? 'STORE_CREDIT' : null,
          currency: 'INR',
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
          source: 'mobile_app',
          createdAt: now,
          syncedAt: isSyncedNow ? now : null,
          items: {
            create: mobileOrderItems
          }
        }
      });

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
            image: item.image || item.imageUrl || null,
          };
        });

        const itemsHtml = formattedItems
          .map(
            (item: any) => `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(255,255,255,0.15); border-radius:2px; overflow:hidden; margin-bottom: 15px;">
          <tr>
            <td class="item-img" width="110" style="vertical-align:top; padding:0;">
              ${item.image ? `<img src="${item.image}" width="110" height="130" style="display:block; object-fit:cover; opacity:0.8;" alt="${item.name}" />` : `<div style="width:110px; height:130px; background:rgba(255,255,255,0.05);"></div>`}
            </td>
            <td style="vertical-align:top; padding:20px 20px 20px 22px; border-left:1px solid rgba(255,255,255,0.1);">
              <p style="margin:0 0 4px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.3); text-transform:uppercase;">Qty: ${item.qty}</p>
              <p style="margin:0 0 6px; font-family:'DM Serif Display',serif; font-size:17px; color:rgba(255,255,255,0.7); line-height:1.3;">${item.name}</p>
              ${item.size !== 'N/A' ? `<p style="margin:0 0 14px; font-family:'DM Mono',monospace; font-size:10px; color:rgba(255,255,255,0.3);">Size: ${item.size}</p>` : ''}
              <p style="margin:0; font-family:'DM Mono',monospace; font-size:12px; color:rgba(255,255,255,0.5);">${item.price}</p>
            </td>
          </tr>
        </table>
        `
          )
          .join('');

        const emailVars = {
          customerName,
          orderId: created.shopifyOrderId || created.id,
          orderDate: new Date(created.createdAt).toLocaleDateString(),
          itemsHtml,
          items: itemsHtml,
          products: itemsHtml,
          subtotal: `INR ${subtotal}`,
          shipping: `INR ${paymentMethod === 'COD' ? 99 : 0}`,
          total: `INR ${total}`,
          totalPrice: `INR ${total}`,
          amount: `INR ${total}`,
          price: `INR ${total}`,
          currency: 'INR',
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
