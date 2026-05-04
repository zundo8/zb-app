import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { createOrder, createCustomer, updateCustomer } from "@/lib/shopify-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { address, paymentMethod, items, total, subtotal, codFee, razorpay } = body;

    const shop = await prisma.shop.findFirst();
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // 1. Verify Payment if not COD
    if (paymentMethod !== "COD") {
      if (!razorpay || !razorpay.razorpay_order_id || !razorpay.razorpay_payment_id || !razorpay.razorpay_signature) {
        return NextResponse.json({ error: "Payment details missing" }, { status: 400 });
      }
      
      // Use env var first, then DB fallback for secret
      let secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) {
        secret = shop.razorpayKeySecret || "";
      }
      if (!secret) {
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
    const shopifyOrderData = {
      line_items: items.map((item: any) => ({
        variant_id: parseInt(item.variantId.split('/').pop()), // Support GID or ID
        quantity: item.quantity
      })),
      customer: {
        id: parseInt(shopifyCustomerId)
      },
      billing_address: {
        first_name: address.name.split(' ')[0],
        last_name: address.name.split(' ').slice(1).join(' ') || '.',
        address1: address.street,
        city: address.city,
        province: address.state,
        zip: address.zip,
        country: address.country
      },
      shipping_address: {
        first_name: address.name.split(' ')[0],
        last_name: address.name.split(' ').slice(1).join(' ') || '.',
        address1: address.street,
        city: address.city,
        province: address.state,
        zip: address.zip,
        country: address.country
      },
      financial_status: paymentMethod === "COD" ? "pending" : "paid",
      note: paymentMethod === "COD" ? "COD Order - ₹99 fee included in total" : "Paid via Razorpay",
      total_tax: 0,
      currency: "INR"
    };

    const sOrder = await createOrder(shopifyOrderData);

    // 4. Create Order in local DB
    const localOrder = await prisma.order.create({
      data: {
        shopId: shop.id,
        shopifyOrderId: sOrder.id.toString(),
        customerId: localCustomer.id,
        status: "open",
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
        items: {
          create: items.map((item: any) => ({
            shopifyLineItemId: `local_${Date.now()}_${item.id}`,
            productId: item.productId,
            title: item.title,
            quantity: item.quantity,
            price: parseFloat(item.price),
            sku: item.id
          }))
        }
      }
    });

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
