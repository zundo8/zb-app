import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { createOrder, createCustomer, updateCustomer } from "@/lib/shopify-admin";
import { resolveRazorpayCredentials } from "@/lib/razorpay-credentials";
import { sendOrderConfirmationEmail, sendOrderCodConfirmationEmail } from "@/lib/services/orderEmailService";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveAndSyncCustomerAddress } from "@/lib/services/customerService";
import { debitStoreCredits } from "@/lib/storeCreditsHelper";
import { assignUniversalOrderNumber, isFailedPrefixNumber } from "@/lib/orderNumber";

export async function POST(req: Request) {
  const rateLimitResult = await checkRateLimit(req, "checkout-complete", { maxRequests: 30, windowMs: 60_000 });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  try {
    const body = await req.json();
    const {
      address,
      paymentMethod = "razorpay",
      items,
      total,
      subtotal,
      codFee,
      razorpay,
      couponCode,
      couponDiscount,
      applyAsStoreCredit,
      cashbackAmount,
      storeCreditAmount = 0,
    } = body;

    let finalCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : null;
    let finalCouponDiscount = Number(couponDiscount) || 0;

    const pmUpper = (paymentMethod || '').toUpperCase().trim();
    const isCodOrder = pmUpper === 'COD' || pmUpper.includes('COD');

    if (finalCouponCode) {
      const dbCoupon = await prisma.webStoreCoupon.findFirst({
        where: { code: finalCouponCode, isActive: true }
      });

      if (!dbCoupon) {
        finalCouponCode = null;
        finalCouponDiscount = 0;
      } else {
        if (dbCoupon.applicability === 'PREPAID_ONLY' && isCodOrder) {
          console.warn(`[Checkout Complete] Stripped PREPAID_ONLY coupon ${finalCouponCode} from COD order`);
          finalCouponCode = null;
          finalCouponDiscount = 0;
        } else if (dbCoupon.applicability === 'COD_ONLY' && !isCodOrder) {
          console.warn(`[Checkout Complete] Stripped COD_ONLY coupon ${finalCouponCode} from prepaid order`);
          finalCouponCode = null;
          finalCouponDiscount = 0;
        } else if (dbCoupon.applicability === 'CUSTOM_RATES') {
          const rateType = isCodOrder ? dbCoupon.codDiscountType : dbCoupon.prepaidDiscountType;
          const rateVal = Number(isCodOrder ? dbCoupon.codDiscountValue : dbCoupon.prepaidDiscountValue);
          const sub = Number(subtotal || 0);
          if (rateType === 'percentage') {
            finalCouponDiscount = Math.round((sub * rateVal) / 100);
          } else {
            finalCouponDiscount = Math.min(rateVal, sub);
          }
          // CUSTOM_RATES with zero COD rate means no discount for COD
          if (isCodOrder && rateVal <= 0) {
            console.warn(`[Checkout Complete] CUSTOM_RATES coupon ${finalCouponCode} has zero COD discount — stripping`);
            finalCouponCode = null;
            finalCouponDiscount = 0;
          }
        }
      }

      // Safety net: strip coupons with "PREPAID" in the code name from COD orders
      if (finalCouponCode && isCodOrder && finalCouponCode.includes('PREPAID')) {
        console.warn(`[Checkout Complete] Safety-net stripped prepaid-named coupon ${finalCouponCode} from COD order`);
        finalCouponCode = null;
        finalCouponDiscount = 0;
      }
    }

    const parsedStoreCredit = Number(storeCreditAmount) || 0;
    const isFullStoreCredit = paymentMethod === "store_credit" || paymentMethod === "STORE_CREDIT" || Number(total) === 0;

    const shop = await prisma.shop.findFirst();
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // 1. Verify Payment (Required for prepaid and COD upfront fee, unless 100% store credit)
    if (!isFullStoreCredit) {
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
        return NextResponse.json({ error: "COD upfront payment details missing" }, { status: 400 });
      }
    }

    // 2. Find/Sync Customer & Address using customerService
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.id || null;
    const { customer: localCustomer } = await resolveAndSyncCustomerAddress(shop.id, address, sessionUserId);

    // Duplicate account check and merge
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

    // Generate universal order number for successful order
    let universalOrderNumber = '';
    try {
      universalOrderNumber = await assignUniversalOrderNumber(prisma);
    } catch (seqErr: any) {
      console.error('[Checkout] Failed to generate universal order number:', seqErr.message);
      universalOrderNumber = `ZB${Date.now().toString().slice(-8)}`;
    }

    // 3. Create Order in Shopify
    const shopifyLineItems = items.map((item: any) => {
      let variantId: number | undefined;
      if (item.variantId) {
        const rawId = String(item.variantId).split('/').pop() || '';
        variantId = parseInt(rawId, 10);
        if (isNaN(variantId)) variantId = undefined;
      }

      if (variantId) {
        return { variant_id: variantId, quantity: item.quantity };
      }
      return {
        title: item.title,
        price: parseFloat(item.price).toFixed(2),
        quantity: item.quantity,
        requires_shipping: true,
      };
    });

    const customerId = parseInt(shopifyCustomerId, 10);
    const resolvedMethodTag = isFullStoreCredit ? "Store Credit" : paymentMethod === "COD" ? "COD" : "Prepaid, Razorpay";
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
      financial_status: isFullStoreCredit ? "paid" : isCodOrder ? "partially_paid" : "paid",
      note: isFullStoreCredit
        ? `Paid 100% via Store Credit (₹${parsedStoreCredit}) from Web Store`
        : isCodOrder
        ? `COD Order from Web Store ${parsedStoreCredit > 0 ? `(₹${parsedStoreCredit} Store Credit applied)` : ''} - ₹${codFee || 99} upfront fee paid via Razorpay (Payment ID: ${razorpay?.razorpay_payment_id || 'N/A'})`
        : `Paid via Razorpay ${parsedStoreCredit > 0 ? `+ ₹${parsedStoreCredit} Store Credit` : ''} from Web Store (Payment ID: ${razorpay?.razorpay_payment_id || 'N/A'})`,
      tags: `WebStoreOrder, WebStore, ${resolvedMethodTag}, zb-order-${universalOrderNumber}`,
      note_attributes: [
        { name: 'internal_order_number', value: universalOrderNumber },
        { name: 'payment_method', value: isFullStoreCredit ? 'STORE_CREDIT' : isCodOrder ? 'COD' : 'PREPAID' },
        { name: 'razorpay_payment_id', value: razorpay?.razorpay_payment_id || '' },
        { name: 'store_credit_amount', value: String(parsedStoreCredit) },
        ...(isCodOrder ? [
          { name: 'cod_upfront_fee', value: String(codFee || 99) },
          { name: 'cod_balance_due', value: parseFloat(String(Math.max(0, Number(total) - (Number(codFee) || 99)))).toFixed(2) }
        ] : [])
      ],
      total_tax: 0,
      currency: "INR",
      ...(finalCouponDiscount && Number(finalCouponDiscount) > 0 ? {
        discount_codes: [
          {
            code: finalCouponCode || "DISCOUNT",
            amount: parseFloat(String(finalCouponDiscount)).toFixed(2),
            type: "fixed_amount"
          }
        ]
      } : {})
    };

    if (isCodOrder) {
      const upfrontFee = Number(codFee || 99);
      shopifyOrderData.transactions = [{
        kind: "sale",
        status: "success",
        amount: parseFloat(String(upfrontFee)).toFixed(2),
        currency: "INR",
        gateway: "razorpay",
        authorization: razorpay?.razorpay_payment_id || `cod_upfront_${Date.now()}`
      }];
    } else {
      shopifyOrderData.transactions = [{
        kind: "sale",
        status: "success",
        amount: parseFloat(total).toFixed(2),
        currency: "INR",
        gateway: isFullStoreCredit ? "store_credit" : "razorpay",
        authorization: razorpay?.razorpay_payment_id || `store_credit_${Date.now()}`
      }];
    }

    if (!isNaN(customerId) && customerId > 0) {
      shopifyOrderData.customer = { id: customerId };
    }

    let shopifyOrderId = null;
    let sOrder: any = null;
    try {
      sOrder = await createOrder(shopifyOrderData);
      shopifyOrderId = sOrder.id.toString();
    } catch (shopifyErr: any) {
      console.error('[Checkout] Shopify order creation failed (will sync later):', shopifyErr.message);
    }

    // Resolve products from DB
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

    // 4. Update existing pre-created Order OR Create Order in local DB
    const rzpOrderId = razorpay?.razorpay_order_id;
    let existingPreCreatedOrder = null;
    if (rzpOrderId || body.localOrderId) {
      existingPreCreatedOrder = await prisma.order.findFirst({
        where: {
          OR: [
            ...(rzpOrderId ? [{ razorpayOrderId: rzpOrderId }] : []),
            ...(body.localOrderId ? [{ id: body.localOrderId }] : [])
          ]
        }
      });
    }

    let localOrder: any = null;
    const finalPaymentMethod = isFullStoreCredit ? "store_credit" : isCodOrder ? "cod" : "razorpay";

    if (existingPreCreatedOrder) {
      // Promote: if the pre-created order has a failed/pending prefix number, assign a real ZB number
      const oldNumber = existingPreCreatedOrder.internalOrderNumber;
      if (isFailedPrefixNumber(oldNumber)) {
        // Keep the old prefix number for traceability
        const previousNumbers = [existingPreCreatedOrder.previousOrderNumbers, oldNumber].filter(Boolean).join(',');
        // universalOrderNumber was already assigned above as a fresh ZB number
        console.log(`[Checkout Complete] Promoting order ${oldNumber} → ${universalOrderNumber}`);

        // Recalculate correct total: subtotal - discount - storeCredit
        const correctedTotal = Math.max(0, Number(subtotal || 0) - Number(finalCouponDiscount || 0) - parsedStoreCredit);

        localOrder = await prisma.order.update({
          where: { id: existingPreCreatedOrder.id },
          data: {
            shopifyOrderId: shopifyOrderId,
            status: isCodOrder ? "open" : "approved",
            paymentStatus: isCodOrder ? "cod_upfront_paid" : "paid",
            razorpayPaymentId: razorpay?.razorpay_payment_id || null,
            paymentCapturedAt: (razorpay || isFullStoreCredit) ? new Date() : null,
            paymentMethod: finalPaymentMethod,
            storeCreditAmount: parsedStoreCredit,
            totalPrice: correctedTotal,
            subtotalPrice: Number(subtotal || 0),
            discountCode: finalCouponCode || null,
            discountAmount: Number(finalCouponDiscount) || 0,
            paymentFailureReason: null,
            tags: `WebStoreOrder, Web, ${finalPaymentMethod}, zb-order-${universalOrderNumber}`,
            note: isFullStoreCredit
              ? `Paid 100% via Store Credit (₹${parsedStoreCredit}) from Web Store`
              : isCodOrder
              ? `COD Order from Web Store ${parsedStoreCredit > 0 ? `(₹${parsedStoreCredit} Store Credit applied)` : ''} - ₹${codFee || 99} upfront fee paid via Razorpay`
              : `Paid via Razorpay ${parsedStoreCredit > 0 ? `+ ₹${parsedStoreCredit} Store Credit` : ''} from Web Store (Payment ID: ${razorpay?.razorpay_payment_id || 'N/A'})`,
            shopifyOrderName: sOrder ? sOrder.name : null,
            shopifySyncStatus: sOrder ? 'synced' : 'failed',
            shopifySyncError: sOrder ? null : 'Shopify order creation failed at checkout complete',
            internalOrderNumber: universalOrderNumber,
            previousOrderNumbers: previousNumbers || null,
          }
        });
      } else {
        // Already has a real ZB number or legacy number — keep it
        universalOrderNumber = existingPreCreatedOrder.internalOrderNumber || universalOrderNumber;

        // Recalculate correct total: subtotal - discount - storeCredit
        const correctedTotal = Math.max(0, Number(subtotal || 0) - Number(finalCouponDiscount || 0) - parsedStoreCredit);

        localOrder = await prisma.order.update({
          where: { id: existingPreCreatedOrder.id },
          data: {
            shopifyOrderId: shopifyOrderId,
            status: isCodOrder ? "open" : "approved",
            paymentStatus: isCodOrder ? "cod_upfront_paid" : "paid",
            razorpayPaymentId: razorpay?.razorpay_payment_id || null,
            paymentCapturedAt: (razorpay || isFullStoreCredit) ? new Date() : null,
            paymentMethod: finalPaymentMethod,
            storeCreditAmount: parsedStoreCredit,
            totalPrice: correctedTotal,
            subtotalPrice: Number(subtotal || 0),
            discountCode: finalCouponCode || null,
            discountAmount: Number(finalCouponDiscount) || 0,
            paymentFailureReason: null,
            tags: `WebStoreOrder, Web, ${finalPaymentMethod}, zb-order-${universalOrderNumber}`,
            note: isFullStoreCredit
              ? `Paid 100% via Store Credit (₹${parsedStoreCredit}) from Web Store`
              : isCodOrder
              ? `COD Order from Web Store ${parsedStoreCredit > 0 ? `(₹${parsedStoreCredit} Store Credit applied)` : ''} - ₹${codFee || 99} upfront fee paid via Razorpay`
              : `Paid via Razorpay ${parsedStoreCredit > 0 ? `+ ₹${parsedStoreCredit} Store Credit` : ''} from Web Store (Payment ID: ${razorpay?.razorpay_payment_id || 'N/A'})`,
            shopifyOrderName: sOrder ? sOrder.name : null,
            shopifySyncStatus: sOrder ? 'synced' : 'failed',
            shopifySyncError: sOrder ? null : 'Shopify order creation failed at checkout complete',
          }
        });
      }
      console.log(`[Checkout Complete] Updated pre-created order ${localOrder.id} (${universalOrderNumber}) status to paid/approved`);
    } else {
      localOrder = await prisma.order.create({
        data: {
          shopId: shop.id,
          shopifyOrderId: shopifyOrderId,
          customerId: localCustomer.id,
          status: isCodOrder ? "open" : "approved",
          totalPrice: total,
          subtotalPrice: subtotal,
          currency: body.currency || "INR",
          displayCountry: body.displayCountry || "IN",
          paymentStatus: isCodOrder ? "cod_upfront_paid" : "paid",
          fulfillmentStatus: "unfulfilled",
          deliveryStatus: "pending",
          shippingAddress: JSON.stringify(address),
          billingAddress: JSON.stringify(address),
          razorpayOrderId: razorpay?.razorpay_payment_id || null,
          razorpayPaymentId: razorpay?.razorpay_payment_id || null,
          paymentMethod: finalPaymentMethod,
          storeCreditAmount: parsedStoreCredit,
          paymentCapturedAt: (razorpay || isFullStoreCredit) ? new Date() : null,
          orderType: "WEB_STORE",
          tags: `WebStoreOrder, Web, ${finalPaymentMethod}, zb-order-${universalOrderNumber}`,
          discountCode: finalCouponCode || null,
          discountAmount: Number(finalCouponDiscount) || 0,
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
    }

    // ─── DEBIT STORE CREDITS FROM CUSTOMER WALLET ───
    if (parsedStoreCredit > 0) {
      try {
        await debitStoreCredits(localCustomer.id, parsedStoreCredit, localOrder.id);
        console.log(`[Checkout Complete] Successfully debited ₹${parsedStoreCredit} store credit for order ${localOrder.id}`);
      } catch (storeCreditDebitErr: any) {
        console.error(`[Checkout Complete] Error debiting store credit for customer ${localCustomer.id}:`, storeCreditDebitErr.message);
      }
    }

    // Record purchase event in analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          eventId: `purchase_${localOrder.id}`,
          eventName: 'purchase',
          customerId: localCustomer.id,
          anonymousId: body.guestId || null,
          sessionId: null,
          platform: 'web',
          orderId: localOrder.id,
          value: total,
          currency: localOrder.currency || body.currency || 'INR',
          quantity: items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0),
          pageUrl: '/checkout/complete',
          metadata: {
            paymentMethod: finalPaymentMethod,
            orderNumber: universalOrderNumber,
            couponCode: finalCouponCode || null,
            discountAmount: Number(finalCouponDiscount) || 0,
            storeCreditAmount: parsedStoreCredit,
          },
        },
      });
    } catch (analyticsErr: any) {
      if (analyticsErr.code !== 'P2002') {
        console.warn('[Checkout Analytics] Failed to record purchase event:', analyticsErr.message);
      }
    }

    // Mark active or abandoned cart converted
    try {
      const cleanPhone = address.phone ? address.phone.replace(/\D/g, "") : null;
      const last10Phone = cleanPhone && cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
      const rawCartId = body.cartId || body.cart_id;

      const matchingCarts = await prisma.cart.findMany({
        where: {
          convertedOrderId: null,
          status: { notIn: ["converted"] },
          OR: [
            ...(rawCartId ? [{ id: rawCartId }, { sessionToken: rawCartId }] : []),
            ...(body.guestId ? [{ sessionToken: body.guestId }] : []),
            ...(localCustomer?.id ? [{ customerId: localCustomer.id }] : []),
            ...(address.phone ? [{ phone: address.phone }] : []),
            ...(last10Phone ? [{ phone: { contains: last10Phone } }] : []),
            ...(address.email ? [{ email: { equals: address.email, mode: "insensitive" as const } }] : [])
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
        console.log(`[Checkout] Marked cart converted: ${primaryCart.id} for order: ${localOrder.id}`);
      }
    } catch (cartErr: any) {
      console.error("[Checkout] Failed to mark cart converted:", cartErr.message);
    }

    // Increment coupon usedCount if coupon was applied
    if (finalCouponCode) {
      try {
        await prisma.webStoreCoupon.update({
          where: { code: finalCouponCode.toUpperCase().trim() },
          data: { usedCount: { increment: 1 } },
        });
        console.log(`[Checkout] Successfully incremented usage for coupon: ${finalCouponCode}`);
      } catch (couponUsageErr: any) {
        console.error(`[Checkout] Failed to increment usedCount for coupon: ${finalCouponCode}`, couponUsageErr.message);
      }
    }

    // Issue cashback if coupon has cashback store credits enabled
    if (finalCouponCode && Number(cashbackAmount) > 0) {
      try {
        const cbAmt = parseFloat(String(cashbackAmount));
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);

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
              description: `Cashback for applying coupon code ${finalCouponCode.toUpperCase()}`,
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

    // Sync WebStoreOrder for dashboard integration
    let webStoreOrder: any = null;
    try {
      const existingWebStoreOrder = await prisma.webStoreOrder.findFirst({
        where: {
          OR: [
            ...(razorpay?.razorpay_order_id ? [{ razorpayOrderId: razorpay.razorpay_order_id }] : []),
            { orderNumber: universalOrderNumber }
          ]
        }
      });

      if (existingWebStoreOrder) {
        webStoreOrder = await prisma.webStoreOrder.update({
          where: { id: existingWebStoreOrder.id },
          data: {
            paymentStatus: isFullStoreCredit ? "paid" : isCodOrder ? "cod_upfront_paid" : "paid",
            paymentMethod: finalPaymentMethod,
            razorpayPaymentId: razorpay?.razorpay_payment_id || null,
            storeCreditAmount: parsedStoreCredit,
            codUpfrontPaid: isCodOrder ? (Number(codFee) || 99) : 0,
            codUpfrontPaymentId: isCodOrder ? (razorpay?.razorpay_payment_id || null) : null,
            notes: isFullStoreCredit
              ? `Paid 100% via Store Credit (₹${parsedStoreCredit})`
              : `${isCodOrder ? `COD Order (₹${Number(codFee) || 99} upfront fee paid)` : "Paid via Razorpay"} ${parsedStoreCredit > 0 ? `+ ₹${parsedStoreCredit} Store Credit` : ''} | Shopify: ${shopifyOrderId || 'Pending'} | Local: ${localOrder.id}`
          }
        });
        console.log(`[Checkout Complete] Updated pre-created WebStoreOrder ${webStoreOrder.id} (${universalOrderNumber}) to paid/cod_upfront_paid`);
      } else {
        webStoreOrder = await prisma.webStoreOrder.create({
          data: {
            orderNumber: universalOrderNumber,
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
            discountCode: finalCouponCode || null,
            discountAmount: Number(finalCouponDiscount) || 0,
            storeCreditAmount: parsedStoreCredit,
            totalAmount: total,
            paymentStatus: isFullStoreCredit ? "paid" : isCodOrder ? "cod_upfront_paid" : "paid",
            paymentMethod: finalPaymentMethod,
            razorpayOrderId: razorpay?.razorpay_order_id || null,
            razorpayPaymentId: razorpay?.razorpay_payment_id || null,
            codUpfrontPaid: isCodOrder ? (Number(codFee) || 99) : 0,
            codUpfrontPaymentId: isCodOrder ? (razorpay?.razorpay_payment_id || null) : null,
            fulfillmentStatus: "unfulfilled",
            notes: isFullStoreCredit
              ? `Paid 100% via Store Credit (₹${parsedStoreCredit})`
              : `${isCodOrder ? `COD Order (₹${Number(codFee) || 99} upfront fee paid)` : "Paid via Razorpay"} ${parsedStoreCredit > 0 ? `+ ₹${parsedStoreCredit} Store Credit` : ''} | Shopify: ${shopifyOrderId || 'Pending'} | Local: ${localOrder.id}`,
            source: "web"
          }
        });
      }
      console.log(`[Checkout] Successfully synced WebStoreOrder for localOrder: ${localOrder.id}, shopifyOrderId: ${shopifyOrderId}`);
    } catch (webStoreOrderErr: any) {
      console.error("[Checkout] Failed to sync WebStoreOrder in DB:", webStoreOrderErr.message);
    }

    // Send order confirmation email to the user
    try {
      const orderPayload = {
        orderId: universalOrderNumber,
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
        currency: localOrder.currency || body.currency || 'INR',
        orderDate: new Date(localOrder.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }),
        paymentMethod: finalPaymentMethod,
        subtotal: Number(subtotal),
        shipping: 0,
        discount: Number(finalCouponDiscount) || 0,
        shippingAddress: `${address.street || ''}, ${address.city || ''}, ${address.state || ''} - ${address.zip || ''}, ${address.country || 'India'}`,
      };

      if (paymentMethod.toLowerCase() === 'cod') {
        await sendOrderCodConfirmationEmail(orderPayload);
      } else {
        await sendOrderConfirmationEmail(orderPayload);
      }

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

    // Save shipping address to Address table
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
    return NextResponse.json({ error: error.message || "Order completion failed" }, { status: 500 });
  }
}
