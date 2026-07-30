import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import prisma from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveAndSyncCustomerAddress } from "@/lib/services/customerService";
import { toMinorUnits } from "@/lib/global-pricing";

export const dynamic = 'force-dynamic';

function getRazorpayInstance(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keyId && keySecret) {
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return null;
}

async function getRazorpayFromDB(): Promise<Razorpay | null> {
  const shop = await prisma.shop.findFirst({
    select: { razorpayKeyId: true, razorpayKeySecret: true },
  });
  if (shop?.razorpayKeyId && shop?.razorpayKeySecret) {
    return new Razorpay({
      key_id: shop.razorpayKeyId,
      key_secret: shop.razorpayKeySecret,
    });
  }
  return null;
}

function getPublicKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
}

export async function POST(req: Request) {
  const rateLimitResult = await checkRateLimit(req, "checkout-razorpay", { maxRequests: 30, windowMs: 60_000 });
  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  try {
    const {
      amount,
      currency = "INR",
      displayCountry = "IN",
      receipt,
      notes,
      address,
      items,
      subtotal,
      total,
      paymentMethod = 'razorpay',
      codFee = 0,
      couponCode,
      couponDiscount = 0,
      storeCreditAmount = 0,
    } = await req.json();

    // Validate required fields
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      );
    }

    // Razorpay instance resolution
    let razorpay = getRazorpayInstance();
    let keyId = getPublicKeyId();

    if (!razorpay) {
      razorpay = await getRazorpayFromDB();
      if (!razorpay) {
        return NextResponse.json(
          { error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
          { status: 400 }
        );
      }
      const shop = await prisma.shop.findFirst({ select: { razorpayKeyId: true } });
      keyId = shop?.razorpayKeyId || keyId;
    }

    const currencyCode = (currency || "INR").toUpperCase();
    const options = {
      amount: toMinorUnits(amount, currencyCode),
      currency: currencyCode,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };

    const rzpOrder = await razorpay.orders.create(options);

    let localOrderId: string | null = null;
    let universalOrderNumber: string | null = null;

    // ─── Pre-Create Order & WebStoreOrder in Local DB ───
    if (address && items && Array.isArray(items) && items.length > 0) {
      try {
        const shop = await prisma.shop.findFirst();
        if (shop) {
          // 1. Save Customer & Address
          const { customer } = await resolveAndSyncCustomerAddress(shop.id, address);

          // 2. Generate Universal Internal Order Number
          const date = new Date();
          const yy = String(date.getFullYear()).slice(-2);
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const yymm = `${yy}${mm}`;

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
            console.error('[Razorpay Checkout] Failed to generate order number:', seqErr.message);
            universalOrderNumber = `ZB-${yymm}-${Math.floor(10000 + Math.random() * 90000)}`;
          }

          // 3. Resolve Line Items
          const resolvedItems = await Promise.all(items.map(async (item: any, index: number) => {
            let dbProductId = null;
            let image = item.image || null;
            if (item.productId) {
              const cleanId = String(item.productId);
              const byShopifyId = await prisma.product.findUnique({ where: { shopifyProductId: cleanId } });
              if (byShopifyId) {
                dbProductId = byShopifyId.id;
                if (!image) image = byShopifyId.featuredImage;
              } else {
                const byCuid = await prisma.product.findUnique({ where: { id: cleanId } });
                if (byCuid) {
                  dbProductId = byCuid.id;
                  if (!image) image = byCuid.featuredImage;
                }
              }
            }

            return {
              shopifyLineItemId: `pre_${rzpOrder.id}_${index}`,
              productId: dbProductId,
              title: item.title,
              quantity: item.quantity,
              price: parseFloat(item.price || '0'),
              sku: item.variantId || item.productId || null,
              image: image
            };
          }));

          const fullStreet = [address.houseNo, address.street, address.landmark, address.apartment].filter(Boolean).join(", ");
          const checkoutAddress = { ...address, street: fullStreet || address.street };

          // 4. Create Pending Order
          const localOrder = await prisma.order.create({
            data: {
              shopId: shop.id,
              shopifyOrderId: null,
              customerId: customer.id,
              status: "payment_pending",
              totalPrice: total || amount,
              subtotalPrice: subtotal || amount,
              totalTax: 0,
              currency: currencyCode,
              displayCountry: displayCountry || "IN",
              paymentStatus: "pending",
              fulfillmentStatus: "unfulfilled",
              deliveryStatus: "pending",
              shippingAddress: JSON.stringify(checkoutAddress),
              billingAddress: JSON.stringify(checkoutAddress),
              razorpayOrderId: rzpOrder.id,
              razorpayPaymentId: null,
              paymentMethod: paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay",
              paymentCapturedAt: null,
              orderType: "WEB_STORE",
              tags: `WebStoreOrder, Web, ${paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay"}, zb-order-${universalOrderNumber}, payment_pending, Order creation in process`,
              note: storeCreditAmount > 0
                ? `Order creation in process - ₹${storeCreditAmount} Store Credit applied - Remaining Payment pending`
                : "Order creation in process - Payment pending",
              discountCode: couponCode || null,
              discountAmount: Number(couponDiscount) || 0,
              storeCreditAmount: Number(storeCreditAmount) || 0,
              internalOrderNumber: universalOrderNumber,
              shopifySyncStatus: 'failed',
              shopifySyncError: 'Order pre-created at payment initiation; payment pending',
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

          localOrderId = localOrder.id;

          // 5. Create Pending WebStoreOrder for Web Store Dashboard
          try {
            await prisma.webStoreOrder.create({
              data: {
                orderNumber: universalOrderNumber,
                customerName: address.name,
                customerEmail: address.email,
                customerPhone: address.phone || "",
                shippingAddress: checkoutAddress as any,
                items: items.map((item: any) => ({
                  product_id: item.productId,
                  variant_id: item.variantId || "",
                  title: item.title,
                  image_url: item.image || "",
                  quantity: item.quantity,
                  price: Number(item.price) || 0,
                  size: item.size || ""
                })) as any,
                subtotal: subtotal || amount,
                shippingCharge: 0,
                discountCode: couponCode || null,
                discountAmount: Number(couponDiscount) || 0,
                storeCreditAmount: Number(storeCreditAmount) || 0,
                totalAmount: total || amount,
                paymentStatus: "payment_pending",
                paymentMethod: paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay",
                razorpayOrderId: rzpOrder.id,
                razorpayPaymentId: null,
                fulfillmentStatus: "unfulfilled",
                notes: storeCreditAmount > 0
                  ? `Order creation in process - ₹${storeCreditAmount} Store Credit applied - Remaining Payment pending`
                  : "Order creation in process - Payment pending",
                source: "web"
              }
            });
          } catch (wsErr: any) {
            console.error("[Razorpay Pre-Create] WebStoreOrder creation notice:", wsErr.message);
          }

          console.log(`[Razorpay Pre-Create] Successfully pre-created pending order ${universalOrderNumber} (${localOrder.id}) with ₹${storeCreditAmount} store credit for Razorpay order ${rzpOrder.id}`);
        }
      } catch (dbErr: any) {
        console.warn("[Razorpay Pre-Create] Warning pre-creating order:", dbErr.message);
      }
    }

    return NextResponse.json({
      razorpay_order_id: rzpOrder.id,
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: keyId,
      keyId: keyId,
      localOrderId,
      internalOrderNumber: universalOrderNumber,
    });
  } catch (error: any) {
    console.error("[Razorpay] Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
