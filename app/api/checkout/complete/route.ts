import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { createOrder, createCustomer, updateCustomer } from "@/lib/shopify-admin";
import { resolveRazorpayCredentials } from "@/lib/razorpay-credentials";
import { sendMail } from "@/lib/mailer";
import { orderConfirmationTemplate } from "@/lib/email-templates";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { address, paymentMethod, items, total, subtotal, codFee, razorpay, couponCode, couponDiscount } = body;

    const shop = await prisma.shop.findFirst();
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // 1. Verify Payment if not COD
    if (paymentMethod !== "COD") {
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
    }

    // 2. Find/Sync Customer
    let localCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: address.email },
          { phone: address.phone }
        ]
      }
    });

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

    // Sync with Shopify if needed
    let shopifyCustomerId = localCustomer.shopifyId;
    if (shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_')) {
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
            // Fallback: use the temp one for order but this might fail shopify order creation if not careful
            // Usually we'd want to search if customer exists first.
        }
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
      note: paymentMethod === "COD" ? "COD Order from Web Store - ₹99 fee included" : "Paid via Razorpay from Web Store",
      tags: `WebStoreOrder, WebStore, ${paymentMethod === "COD" ? "COD" : "Razorpay"}`,
      total_tax: 0,
      currency: "INR"
    };

    // Only add customer if we have a valid numeric Shopify ID
    if (!isNaN(customerId) && customerId > 0) {
      shopifyOrderData.customer = { id: customerId };
    }

    // Try to create order in Shopify — but don't fail the entire checkout if Shopify is down
    let shopifyOrderId = `app_pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const sOrder = await createOrder(shopifyOrderData);
      shopifyOrderId = sOrder.id.toString();
    } catch (shopifyErr: any) {
      console.error('[Checkout] Shopify order creation failed (will sync later):', shopifyErr.message);
      // Order will be saved locally and can be synced to Shopify later via admin dashboard
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
        paymentCapturedAt: paymentMethod !== "COD" ? new Date() : null,
        orderType: "WEB_STORE",
        tags: `WebStoreOrder, Web, ${paymentMethod === "COD" ? "COD" : "Razorpay"}`,
        discountCode: couponCode || null,
        discountAmount: Number(couponDiscount) || 0,
        items: {
          create: items.map((item: any, index: number) => ({
            shopifyLineItemId: `web_${Date.now()}_${index}_${item.productId || item.variantId}`,
            productId: item.productId,
            title: item.title,
            quantity: item.quantity,
            price: parseFloat(item.price),
            sku: item.variantId || item.productId
          }))
        }
      }
    });

    // Also create a WebStoreOrder for the web-store dashboard integration
    try {
      // Generate a fallback order number in case the DB trigger doesn't fire (e.g. SQLite / non-Postgres)
      const fallbackOrderNumber = `ZB-WEB-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      await prisma.webStoreOrder.create({
        data: {
          orderNumber: fallbackOrderNumber, // DB trigger will override on Postgres; fallback used on other DBs
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
          paymentStatus: paymentMethod === "COD" ? "pending" : "paid",
          paymentMethod: paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay",
          razorpayOrderId: razorpay?.razorpay_order_id || null,
          razorpayPaymentId: razorpay?.razorpay_payment_id || null,
          fulfillmentStatus: "unfulfilled",
          notes: `${paymentMethod === "COD" ? "COD Order" : "Paid via Razorpay"} from Web Store | Shopify: ${shopifyOrderId} | Local: ${localOrder.id}`,
          source: "web"
        }
      });
      console.log(`[Checkout] Successfully synced WebStoreOrder for localOrder: ${localOrder.id}, shopifyOrderId: ${shopifyOrderId}`);
    } catch (webStoreOrderErr: any) {
      console.error("[Checkout] Failed to create WebStoreOrder in DB:", webStoreOrderErr.message);
    }

    // Send order confirmation email to the user directly
    try {
      const confirmationHtml = orderConfirmationTemplate({
        customerName: address.name || "Customer",
        orderId: localOrder.shopifyOrderId || localOrder.id,
        orderDate: new Date(localOrder.createdAt).toLocaleDateString(),
        items: items.map((item: any) => ({
          name: item.title,
          size: item.size || 'N/A',
          qty: item.quantity,
          price: `INR ${item.price}`,
        })),
        subtotal: `INR ${subtotal}`,
        shipping: `INR ${codFee ? 99 : 0}`,
        total: `INR ${total}`,
        shippingAddress: `${address.street}, ${address.city}, ${address.state} - ${address.zip}, ${address.country || 'India'}`,
      });

      const emailResult = await sendMail({
        to: address.email,
        subject: `Order Confirmed - ${localOrder.shopifyOrderId || localOrder.id}`,
        html: confirmationHtml,
      });

      // Log the email in our system logs
      await prisma.emailLog.create({
        data: {
          recipientEmail: address.email,
          recipientName: address.name,
          subject: `Order Confirmed - ${localOrder.shopifyOrderId || localOrder.id}`,
          templateName: 'Order Confirmed',
          triggerEvent: 'checkout/complete',
          referenceId: localOrder.id,
          status: emailResult.messageId ? 'sent' : 'failed',
          messageId: emailResult.messageId || null,
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
          subject: `Order Confirmed - ${localOrder.shopifyOrderId || localOrder.id}`,
          templateName: 'Order Confirmed',
          triggerEvent: 'checkout/complete',
          referenceId: localOrder.id,
          status: 'failed',
          errorMessage: emailErr.message,
          sentBy: 'system',
        }
      });
    }

    // Update customer name and address for next time
    await prisma.customer.update({
        where: { id: localCustomer.id },
        data: { 
            name: address.name,
            defaultAddress: JSON.stringify(address) 
        }
    });

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
