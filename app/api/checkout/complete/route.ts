import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { createOrder, createCustomer, updateCustomer } from "@/lib/shopify-admin";
import { resolveRazorpayCredentials } from "@/lib/razorpay-credentials";
import { sendMail } from "@/lib/mailer";
import { sendOrderConfirmationEmail, sendOrderCodConfirmationEmail } from "@/lib/services/orderEmailService";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rateLimitResult = await checkRateLimit(req, "checkout-complete", { maxRequests: 30, windowMs: 60_000 });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  try {
    const body = await req.json();
    const { address, paymentMethod, items, total, subtotal, codFee, razorpay, couponCode, couponDiscount, applyAsStoreCredit, cashbackAmount } = body;

    const shop = await prisma.shop.findFirst();
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // 1. Verify Payment (Required for both prepaid and COD upfront fee)
    if (paymentMethod !== "COD" || razorpay) {
      if (!razorpay || !razorpay.razorpay_order_id || !razorpay.razorpay_payment_id || !razorpay.razorpay_signature) {
        return NextResponse.json({ error: "Payment details missing" }, { status: 400 });
      }

      // Accept mock payments for testing
      const isMock = razorpay.razorpay_order_id.startsWith('order_mock_') || razorpay.razorpay_signature === 'mock_sig_valid';
      
      if (!isMock) {
        let secret: string;
        try {
          secret = (await resolveRazorpayCredentials()).key_secret;
        } catch {
          return NextResponse.json({ error: "Payment verification not configured" }, { status: 500 });
        }

        const generated_signature = crypto
          .createHmac("sha256", secret)
          .update(razorpay.razorpay_order_id + "|" + razorpay.razorpay_payment_id)
          .digest("hex");

        // Timing-safe comparison to prevent timing attacks
        try {
          const sigBuffer = Buffer.from(razorpay.razorpay_signature, "utf-8");
          const genBuffer = Buffer.from(generated_signature, "utf-8");
          if (sigBuffer.length !== genBuffer.length || !crypto.timingSafeEqual(sigBuffer, genBuffer)) {
            console.error("[Razorpay] Signature mismatch for order:", razorpay.razorpay_order_id);
            return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
          }
        } catch {
          console.error("[Razorpay] Signature verification error");
          return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
        }
      } else {
        console.warn('[Checkout] Accepting MOCK payment for testing');
      }
    } else {
      // paymentMethod === "COD" but no razorpay object was sent
      return NextResponse.json({ error: "COD upfront payment details missing" }, { status: 400 });
    }

    // 2. Find/Sync Customer
    const session = await getServerSession(authOptions);
    let localCustomer = null;

    if (session?.user) {
      const whereClause: any = { OR: [] };
      if (session.user.email) {
        whereClause.OR.push({ email: session.user.email });
      }
      const userId = (session.user as any).id;
      if (userId) {
        whereClause.OR.push({ id: userId });
      }
      if (whereClause.OR.length > 0) {
        localCustomer = await prisma.customer.findFirst({
          where: whereClause
        });
      }
    }

    if (!localCustomer) {
      localCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { email: address.email },
            { phone: address.phone }
          ]
        }
      });
    }

    if (!localCustomer) {
      // Should not happen if they are logged in, but handle guest-like flow or sync
      localCustomer = await prisma.customer.create({
        data: {
          email: address.email,
          phone: address.phone,
          name: address.name,
          shopId: shop.id,
          shopifyId: `temp_${Date.now()}`
        }
      });
    }

    // Duplicate account check and merge:
    // If user inputs a phone number at checkout, check if another customer profile has this phone number.
    if (address.phone) {
      const duplicateCustomer = await prisma.customer.findFirst({
        where: {
          phone: address.phone,
          id: { not: localCustomer.id }
        }
      });

      if (duplicateCustomer) {
        console.log(`[Checkout Merge] Merging duplicate customer account: ${duplicateCustomer.id} -> ${localCustomer.id}`);
        try {
          // Perform merging in a transaction
          await prisma.$transaction([
            prisma.order.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.address.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.return.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.returnRequest.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.exchangeRequest.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.payment.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.profileHistory.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.mobileOrder.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.communityMessage.updateMany({
              where: { customerId: duplicateCustomer.id },
              data: { customerId: localCustomer.id }
            }),
            prisma.cart.deleteMany({
              where: { customerId: duplicateCustomer.id }
            }),
            prisma.follow.deleteMany({
              where: {
                OR: [
                  { followerId: duplicateCustomer.id },
                  { followingId: duplicateCustomer.id }
                ]
              }
            })
          ]);

          // Migrate Wishlist (outside transaction to safely try/catch unique constraint violations)
          const dupWishlist = await prisma.wishlist.findMany({
            where: { customerId: duplicateCustomer.id }
          });
          for (const item of dupWishlist) {
            try {
              await prisma.wishlist.update({
                where: { id: item.id },
                data: { customerId: localCustomer.id }
              });
            } catch {
              await prisma.wishlist.delete({
                where: { id: item.id }
              });
            }
          }

          // Migrate CommunityMember
          const dupCommunity = await prisma.communityMember.findUnique({
            where: { customerId: duplicateCustomer.id }
          });
          if (dupCommunity) {
            const primCommunity = await prisma.communityMember.findUnique({
              where: { customerId: localCustomer.id }
            });
            if (!primCommunity) {
              await prisma.communityMember.update({
                where: { id: dupCommunity.id },
                data: { customerId: localCustomer.id }
              });
            } else {
              await prisma.communityMember.delete({
                where: { id: dupCommunity.id }
              });
            }
          }

          // Delete duplicate customer record
          await prisma.customer.delete({
            where: { id: duplicateCustomer.id }
          });
          console.log(`[Checkout Merge] Merging completed successfully.`);
        } catch (mergeErr: any) {
          console.error("[Checkout Merge] Error occurred during account merge:", mergeErr);
        }
      }
    }

    // Sync with Shopify if needed
    let shopifyCustomerId = localCustomer.shopifyId;
    if (shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_') || shopifyCustomerId.startsWith('apple_')) {
        try {
            const sCustomer = await createCustomer({
                first_name: address.name.split(' ')[0],
                last_name: address.name.split(' ').slice(1).join(' ') || '.',
                email: address.email,
                phone: address.phone,
                verified_email: true,
                addresses: [{
                    address1: address.street,
                    city: address.city,
                    province: address.state,
                    zip: address.zip,
                    country: address.country,
                    default: true
                }]
            });
            shopifyCustomerId = sCustomer.id.toString();
            await prisma.customer.update({
                where: { id: localCustomer.id },
                data: { shopifyId: shopifyCustomerId }
            });
        } catch (e) {
            console.error("Shopify Customer Sync Error:", e);
        }
    }

    // Generate universal internal order number
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;
    
    let universalOrderNumber = '';
    try {
      const seqRes: any[] = await prisma.$queryRawUnsafe(`
        INSERT INTO order_sequences (year_month, current_value)
        VALUES ($1, 1)
        ON CONFLICT (year_month)
        DO UPDATE SET current_value = order_sequences.current_value + 1
        RETURNING current_value;
      `, yymm);
      const seqVal = seqRes[0].current_value;
      universalOrderNumber = `ZB-${yymm}-${String(seqVal).padStart(5, '0')}`;
    } catch (seqErr: any) {
      console.error('[Checkout] Failed to generate universal internal order number:', seqErr.message);
      // Fallback in case of database issue
      universalOrderNumber = `ZB-${yymm}-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    // 3. Create Order in Shopify
    const shopifyLineItems = items.map((item: any) => {
      // Parse variant_id safely — support GID format (gid://shopify/ProductVariant/123) or plain ID
      let variantId: number | undefined;
      if (item.variantId) {
        const rawId = String(item.variantId).split('/').pop() || '';
        variantId = parseInt(rawId, 10);
        if (isNaN(variantId)) variantId = undefined;
      }
      
      if (variantId) {
        return { variant_id: variantId, quantity: item.quantity };
      }
      // Fallback: use title and price if no variant_id
      return {
        title: item.title,
        price: parseFloat(item.price).toFixed(2),
        quantity: item.quantity,
        requires_shipping: true,
      };
    });

    const customerId = parseInt(shopifyCustomerId, 10);
    const shopifyOrderData: any = {
      line_items: shopifyLineItems,
      email: address.email,
      send_receipt: false,
      send_fulfillment_receipt: false,
      billing_address: {
        first_name: address.name.split(' ')[0],
        last_name: address.name.split(' ').slice(1).join(' ') || '.',
        address1: address.street,
        city: address.city,
        province: address.state,
        zip: address.zip,
        country: address.country,
        phone: address.phone
      },
      shipping_address: {
        first_name: address.name.split(' ')[0],
        last_name: address.name.split(' ').slice(1).join(' ') || '.',
        address1: address.street,
        city: address.city,
        province: address.state,
        zip: address.zip,
        country: address.country,
        phone: address.phone
      },
      phone: address.phone,
      financial_status: paymentMethod === "COD" ? "pending" : "paid",
      note: paymentMethod === "COD" 
        ? `COD Order from Web Store - ₹${codFee || 99} upfront fee paid via Razorpay (Payment ID: ${razorpay?.razorpay_payment_id || 'N/A'})` 
        : `Paid via Razorpay from Web Store (Payment ID: ${razorpay?.razorpay_payment_id || 'N/A'})`,
      tags: `WebStoreOrder, WebStore, ${paymentMethod === "COD" ? "COD" : "Prepaid, Razorpay"}, zb-order-${universalOrderNumber}`,
      note_attributes: [
        { name: 'internal_order_number', value: universalOrderNumber },
        { name: 'payment_method', value: paymentMethod === "COD" ? 'COD' : 'PREPAID' },
        { name: 'razorpay_payment_id', value: razorpay?.razorpay_payment_id || '' }
      ],
      total_tax: 0,
      currency: "INR",
      ...(couponDiscount && Number(couponDiscount) > 0 ? {
        discount_codes: [
          {
            code: couponCode || "DISCOUNT",
            amount: parseFloat(String(couponDiscount)).toFixed(2),
            type: "fixed_amount"
          }
        ]
      } : {})
    };

    // Add transactions so Shopify records the actual paid amount
    if (paymentMethod !== "COD") {
      // PREPAID: Full amount paid via Razorpay
      shopifyOrderData.transactions = [{
        kind: "sale",
        status: "success",
        amount: parseFloat(total).toFixed(2),
        currency: "INR",
        gateway: "razorpay",
        authorization: razorpay?.razorpay_payment_id || null
      }];
    } else {
      // COD: Only the upfront fee (₹99) is paid now, rest is collected on delivery
      // financial_status stays "pending" because the full order isn't paid yet
      // We record the upfront fee as a note attribute for reference
      shopifyOrderData.note_attributes.push(
        { name: 'cod_upfront_fee', value: String(codFee || 99) },
        { name: 'cod_upfront_payment_id', value: razorpay?.razorpay_payment_id || '' }
      );
    }

    // Only add customer if we have a valid numeric Shopify ID
    if (!isNaN(customerId) && customerId > 0) {
      shopifyOrderData.customer = { id: customerId };
    }

    // Try to create order in Shopify — but don't fail the entire checkout if Shopify is down
    let shopifyOrderId = null;
    let sOrder: any = null;
    try {
      sOrder = await createOrder(shopifyOrderData);
      shopifyOrderId = sOrder.id.toString();
    } catch (shopifyErr: any) {
      console.error('[Checkout] Shopify order creation failed (will sync later):', shopifyErr.message);
      // Order will be saved locally and can be synced to Shopify later via admin dashboard
    }

    // Resolve products from DB to get correct local database IDs (cuid) and shopify line item IDs
    const resolvedItems = [];
    if (sOrder && sOrder.line_items) {
      for (const li of sOrder.line_items) {
        let dbProductId = null;
        let image = null;
        if (li.product_id) {
          const shopifyProdId = String(li.product_id);
          const byShopifyId = await prisma.product.findUnique({
            where: { shopifyProductId: shopifyProdId }
          });
          if (byShopifyId) {
            dbProductId = byShopifyId.id;
            image = byShopifyId.featuredImage;
          }
        }
        // Fallback to request items mapping for image if not found in db product
        if (!image) {
          const matchingRequestItem = items.find((item: any) => {
            const liVariantId = String(li.variant_id);
            const reqVariantId = item.variantId ? String(item.variantId).split('/').pop() : '';
            return liVariantId === reqVariantId || li.title === item.title;
          });
          if (matchingRequestItem) {
            image = matchingRequestItem.image || null;
          }
        }
        resolvedItems.push({
          shopifyLineItemId: String(li.id),
          productId: dbProductId,
          title: li.title,
          quantity: li.quantity,
          price: li.price ? parseFloat(li.price) : 0,
          sku: li.sku || null,
          image: image
        });
      }
    } else {
      // Fallback if Shopify order creation failed
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        let dbProductId = null;
        let image = item.image || null;
        if (item.productId) {
          const cleanId = String(item.productId);
          const byShopifyId = await prisma.product.findUnique({
            where: { shopifyProductId: cleanId }
          });
          if (byShopifyId) {
            dbProductId = byShopifyId.id;
            if (!image) image = byShopifyId.featuredImage;
          } else {
            const byCuid = await prisma.product.findUnique({
              where: { id: cleanId }
            });
            if (byCuid) {
              dbProductId = byCuid.id;
              if (!image) image = byCuid.featuredImage;
            }
          }
        }
        resolvedItems.push({
          shopifyLineItemId: `web_${Date.now()}_${index}_${item.productId || item.variantId || 'item'}`,
          productId: dbProductId,
          title: item.title,
          quantity: item.quantity,
          price: parseFloat(item.price || '0'),
          sku: item.variantId || item.productId || null,
          image: image
        });
      }
    }

    // 4. Create Order in local DB
    const localOrder = await prisma.order.create({
      data: {
        shopId: shop.id,
        shopifyOrderId: shopifyOrderId,
        customerId: localCustomer.id,
        status: paymentMethod === "COD" ? "open" : "approved",
        totalPrice: total,
        subtotalPrice: subtotal,
        paymentStatus: paymentMethod === "COD" ? "pending" : "paid",
        fulfillmentStatus: "unfulfilled",
        deliveryStatus: "pending",
        shippingAddress: JSON.stringify(address),
        billingAddress: JSON.stringify(address),
        razorpayOrderId: razorpay?.razorpay_order_id || null,
        razorpayPaymentId: razorpay?.razorpay_payment_id || null,
        paymentMethod: paymentMethod === "COD" ? "COD" : "razorpay",
        paymentCapturedAt: razorpay ? new Date() : null,
        orderType: "WEB_STORE",
        tags: `WebStoreOrder, Web, ${paymentMethod === "COD" ? "COD" : "Razorpay"}, zb-order-${universalOrderNumber}`,
        discountCode: couponCode || null,
        discountAmount: Number(couponDiscount) || 0,
        
        // Universal Numbering & Sync fields
        internalOrderNumber: universalOrderNumber,
        shopifyOrderName: sOrder ? sOrder.name : null,
        shopifySyncStatus: sOrder ? 'synced' : 'failed',
        shopifySyncError: sOrder ? null : 'Shopify order creation failed at checkout complete',
        
        items: {
          create: resolvedItems.map((item: any) => ({
            shopifyLineItemId: item.shopifyLineItemId,
            productId: item.productId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
            image: item.image
          }))
        }
      }
    });

    // ─── Record authoritative purchase event in analytics (server-side, exactly-once) ───
    try {
      await prisma.analyticsEvent.create({
        data: {
          eventId: `purchase_${localOrder.id}`,
          eventName: 'purchase',
          customerId: localCustomer.id,
          anonymousId: body.guestId || null,
          sessionId: null, // Server-side event — no client session
          platform: 'web',
          orderId: localOrder.id,
          value: total,
          currency: 'INR',
          quantity: items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
          pageUrl: '/checkout/complete',
          metadata: {
            paymentMethod: paymentMethod,
            orderNumber: universalOrderNumber,
            couponCode: couponCode || null,
            discountAmount: Number(couponDiscount) || 0,
          },
        },
      });
    } catch (analyticsErr: any) {
      // P2002 = duplicate (idempotent), or any other error — never block checkout
      if (analyticsErr.code !== 'P2002') {
        console.warn('[Checkout Analytics] Failed to record purchase event:', analyticsErr.message);
      }
    }

    // Mark active or abandoned cart converted and link convertedOrderId
    try {
      const matchingCarts = await prisma.cart.findMany({
        where: {
          status: { in: ["active", "abandoned"] },
          OR: [
            { customerId: localCustomer.id },
            ...(address.phone ? [{ phone: address.phone }] : []),
            ...(address.email ? [{ email: address.email }] : []),
            ...(body.guestId ? [{ sessionToken: body.guestId }] : [])
          ]
        },
        orderBy: { lastActivityAt: "desc" }
      });

      if (matchingCarts.length > 0) {
        const primaryCart = matchingCarts[0];
        await prisma.cart.update({
          where: { id: primaryCart.id },
          data: {
            status: "converted",
            convertedOrderId: localOrder.id
          }
        });

        if (matchingCarts.length > 1) {
          const extraCartIds = matchingCarts.slice(1).map((c: any) => c.id);
          await prisma.cart.updateMany({
            where: { id: { in: extraCartIds } },
            data: { status: "merged" }
          });
        }
        console.log(`[Checkout] Marked cart converted: ${primaryCart.id} for customer: ${localCustomer.id}`);
      }
    } catch (cartErr: any) {
      console.error("[Checkout] Failed to mark cart converted:", cartErr.message);
    }

    // Increment coupon usedCount if coupon was applied
    if (couponCode) {
      try {
        await prisma.webStoreCoupon.update({
          where: { code: couponCode.toUpperCase().trim() },
          data: { usedCount: { increment: 1 } },
        });
        console.log(`[Checkout] Successfully incremented usage for coupon: ${couponCode}`);
      } catch (couponUsageErr: any) {
        console.error(`[Checkout] Failed to increment usedCount for coupon: ${couponCode}`, couponUsageErr.message);
      }
    }

    // Issue cashback if coupon has cashback store credits enabled
    if (couponCode && Number(cashbackAmount) > 0) {
      try {
        const cbAmt = parseFloat(String(cashbackAmount));
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

        await prisma.$transaction([
          prisma.customer.update({
            where: { id: localCustomer.id },
            data: {
              storeCredits: { increment: cbAmt }
            }
          }),
          prisma.storeCredit.create({
            data: {
              customerId: localCustomer.id,
              amount: cbAmt,
              type: "COUPON_REBATE",
              description: `Cashback for applying coupon code ${couponCode.toUpperCase()}`,
              orderId: localOrder.id,
              expiresAt,
              remainingAmount: cbAmt
            }
          })
        ]);
        console.log(`[Checkout Store Credit] Successfully credited ₹${cbAmt} (90-day expiry) to customer ${localCustomer.id}`);
      } catch (storeCreditErr: any) {
        console.error("[Checkout Store Credit] Failed to issue cashback:", storeCreditErr.message);
      }
    }

    // Also create a WebStoreOrder for the web-store dashboard integration
    let webStoreOrder: any = null;
    try {
      webStoreOrder = await prisma.webStoreOrder.create({
        data: {
          orderNumber: universalOrderNumber, // Set directly to universal number
          customerName: address.name,
          customerEmail: address.email,
          customerPhone: address.phone || "",
          shippingAddress: address as any,
          items: items.map((item: any) => ({
            product_id: item.productId,
            variant_id: item.variantId || "",
            title: item.title,
            image_url: item.image || "",
            quantity: item.quantity,
            price: Number(item.price) || 0,
            size: item.size || ""
          })) as any,
          subtotal: subtotal,
          shippingCharge: 0,
          discountCode: couponCode || null,
          discountAmount: Number(couponDiscount) || 0,
          totalAmount: total,
          paymentStatus: paymentMethod === "COD" ? "cod_upfront_paid" : "paid",
          paymentMethod: paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay",
          razorpayOrderId: razorpay?.razorpay_order_id || null,
          razorpayPaymentId: razorpay?.razorpay_payment_id || null,
          codUpfrontPaid: paymentMethod === "COD" ? codFee : 0,
          codUpfrontPaymentId: paymentMethod === "COD" ? (razorpay?.razorpay_payment_id || null) : null,
          fulfillmentStatus: "unfulfilled",
          notes: `${paymentMethod === "COD" ? `COD Order (₹99 upfront fee paid: ${razorpay?.razorpay_payment_id || 'N/A'})` : "Paid via Razorpay"} from Web Store | Shopify: ${shopifyOrderId || 'Pending'} | Local: ${localOrder.id}`,
          source: "web"
        }
      });
      console.log(`[Checkout] Successfully synced WebStoreOrder for localOrder: ${localOrder.id}, shopifyOrderId: ${shopifyOrderId}`);
    } catch (webStoreOrderErr: any) {
      console.error("[Checkout] Failed to create WebStoreOrder in DB:", webStoreOrderErr.message);
    }

    // Send order confirmation email to the user directly
    try {
      const orderPayload = {
        orderId: universalOrderNumber, // Universal ID
        customerEmail: address.email,
        customerName: address.name || "Customer",
        items: items.map((item: any) => ({
          name: item.title,
          size: item.size || 'N/A',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
          image: item.image || '',
          product_id: item.productId || null,
          variant_title: item.variantId || null,
        })),
        total: Number(total),
        currency: 'INR',
        orderDate: new Date(localOrder.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }),
        paymentMethod: paymentMethod,
        subtotal: Number(subtotal),
        shipping: 0,
        discount: Number(couponDiscount) || 0,
        shippingAddress: `${address.street || ''}, ${address.city || ''}, ${address.state || ''} - ${address.zip || ''}, ${address.country || 'India'}`,
      };

      if (paymentMethod.toLowerCase() === 'cod') {
        await sendOrderCodConfirmationEmail(orderPayload);
      } else {
        await sendOrderConfirmationEmail(orderPayload);
      }

      // Log the email in our system logs
      await prisma.emailLog.create({
        data: {
          recipientEmail: address.email,
          recipientName: address.name,
          subject: `Order Confirmed - ${orderPayload.orderId}`,
          templateName: 'ORDER_CONFIRMATION',
          triggerEvent: 'checkout/complete',
          referenceId: localOrder.id,
          status: 'sent',
          sentBy: 'system',
        }
      });
    } catch (emailErr: any) {
      console.error("[Email Trigger Error] Failed to send order confirmation email:", emailErr.message);
      // Don't crash checkout if email fails, but log it
      await prisma.emailLog.create({
        data: {
          recipientEmail: address.email,
          recipientName: address.name,
          subject: `Order Confirmed - ${webStoreOrder?.orderNumber || localOrder.shopifyOrderId || localOrder.id}`,
          templateName: 'ORDER_CONFIRMATION',
          triggerEvent: 'checkout/complete',
          referenceId: localOrder.id,
          status: 'failed',
          errorMessage: emailErr.message,
          sentBy: 'system',
        }
      });
    }

    // Update customer name, phone, and address for next time
    await prisma.customer.update({
        where: { id: localCustomer.id },
        data: { 
            name: address.name,
            phone: address.phone,
            defaultAddress: JSON.stringify(address) 
        }
    });

    // Save shipping address to Address table if it doesn't exist
    try {
      const existingAddr = await prisma.address.findFirst({
        where: {
          customerId: localCustomer.id,
          address1: address.street,
          city: address.city,
          zip: address.zip,
          phone: address.phone || ""
        }
      });

      if (!existingAddr) {
        // Find if they have any addresses to see if this is the first (and thus default)
        const addressesCount = await prisma.address.count({
          where: { customerId: localCustomer.id }
        });

        await prisma.address.create({
          data: {
            customerId: localCustomer.id,
            name: address.name,
            phone: address.phone || "",
            email: address.email || "",
            address1: address.street,
            address2: address.apartment || "",
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country || "India",
            isDefault: addressesCount === 0,
            lat: address.lat != null ? parseFloat(address.lat) : null,
            lng: address.lng != null ? parseFloat(address.lng) : null,
            placeId: address.placeId || null,
          }
        });
        console.log(`[Checkout] Saved new shipping address for customer: ${localCustomer.id}`);
      }
    } catch (addrErr: any) {
      console.error("[Checkout] Error saving shipping address to Address table:", addrErr.message);
    }

    try {
        await updateCustomer(shopifyCustomerId, {
            first_name: address.name.split(' ')[0],
            last_name: address.name.split(' ').slice(1).join(' ') || '.',
            phone: address.phone,
        });
    } catch (e) {
        console.error("Shopify Customer Name Update Error:", e);
    }

    return NextResponse.json({ orderId: localOrder.id });
  } catch (error: any) {
    console.error("Order Completion Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
