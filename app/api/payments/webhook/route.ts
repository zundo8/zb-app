/**
 * POST /api/payments/webhook — Razorpay Webhook Handler
 * 
 * Validates signature, stores event for idempotency,
 * and processes payment.captured, payment.failed, refund.created events.
 * 
 * This endpoint is NOT protected by session auth — it uses
 * webhook signature validation instead (excluded from middleware matcher).
 */

import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { shipOrder } from "@/lib/services/logistics";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Read raw body BEFORE parsing
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Validate webhook signature
    if (!webhookSecret) {
      console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    try {
      const sigBuf = Buffer.from(signature, "utf-8");
      const expBuf = Buffer.from(expectedSignature, "utf-8");
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.error("[Razorpay Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    // Parse payload after signature validation
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = payload.event;
    const eventId = payload.payload?.payment?.entity?.id || 
                    payload.payload?.refund?.entity?.id ||
                    `rp_${Date.now()}`;

    // Idempotency check — skip if already processed
    const existingEvent = await prisma.webhookEvent.findFirst({
      where: {
        source: "razorpay",
        eventType,
        payload: { contains: eventId },
      },
    });

    if (existingEvent?.processed) {
      console.log(`[Razorpay Webhook] Event already processed: ${eventType} (${eventId})`);
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    // Insert event record (unprocessed)
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        source: "razorpay",
        eventType,
        payload: rawBody,
        processed: false,
      },
    });

    // Process events
    try {
      if (eventType === "payment.captured") {
        const payment = payload.payload?.payment?.entity;
        const razorpayOrderId = payment?.order_id;
        const razorpayPaymentId = payment?.id;

        if (razorpayOrderId) {
          const order = await prisma.order.findFirst({
            where: { razorpayOrderId },
            include: { 
              items: true, 
              customer: true,
            },
          });

          if (order) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: "paid",
                razorpayPaymentId,
                paymentCapturedAt: new Date(),
                paymentMethod: payment?.method || "razorpay",
              },
            });

            console.log(`[Razorpay Webhook] payment.captured → Order ${order.id} marked paid`);

            // Update corresponding MobileOrder status
            const match = (order.tags || '').match(/zb-order-([A-Za-z0-9-]+)/);
            const mobileOrderNumber = match ? match[1] : order.shopifyOrderId?.replace(/^#/, '');
            if (mobileOrderNumber) {
              try {
                await prisma.mobileOrder.updateMany({
                  where: { orderNumber: mobileOrderNumber },
                  data: {
                    status: 'synced',
                    paymentStatus: 'paid',
                    paymentId: razorpayPaymentId,
                    syncedAt: new Date(),
                    tags: `${order.tags || ''}, synced`,
                  }
                });
                console.log(`[Razorpay Webhook] MobileOrder ${mobileOrderNumber} status updated to synced`);
              } catch (moErr: any) {
                console.warn('[Razorpay Webhook] Failed to update corresponding MobileOrder:', moErr.message);
              }
            }

            // Auto-create shipment after payment captured
            try {
              const shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
              if (shippingAddress) {
                await shipOrder(
                  order.id,
                  order.items.map((i: any) => ({
                    title: i.title,
                    sku: i.sku || undefined,
                    quantity: i.quantity,
                    price: i.price,
                  })),
                  {
                    name: shippingAddress.name || "",
                    address1: shippingAddress.street || shippingAddress.address1 || "",
                    city: shippingAddress.city || "",
                    province: shippingAddress.state || "",
                    zip: shippingAddress.zip || "",
                    country: shippingAddress.country || "India",
                    phone: shippingAddress.phone || "",
                  }
                );
                console.log(`[Razorpay Webhook] Auto-shipment created for order ${order.id}`);
              }
            } catch (shipErr: any) {
              // Payment is already confirmed — shipment failure should NOT rollback payment
              console.error(`[Razorpay Webhook] Auto-shipment failed for order ${order.id}:`, shipErr.message);
            }
          }
        }
      } else if (eventType === "payment.failed") {
        const payment = payload.payload?.payment?.entity;
        const razorpayOrderId = payment?.order_id;

        if (razorpayOrderId) {
          await prisma.order.updateMany({
            where: { razorpayOrderId },
            data: { paymentStatus: "failed" },
          });
          console.log(`[Razorpay Webhook] payment.failed → Order with razorpay_order_id ${razorpayOrderId}`);
        }
      } else if (eventType === "refund.created") {
        const refund = payload.payload?.refund?.entity;
        const paymentId = refund?.payment_id;

        if (paymentId) {
          await prisma.order.updateMany({
            where: { razorpayPaymentId: paymentId },
            data: { paymentStatus: "refunded" },
          });
          console.log(`[Razorpay Webhook] refund.created → Order with payment_id ${paymentId}`);
        }
      }

      // Mark event as processed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (processErr: any) {
      console.error("[Razorpay Webhook] Processing error:", processErr.message);
      // Event is recorded but not marked processed — will be retried
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Razorpay Webhook] Fatal error:", error.message);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
