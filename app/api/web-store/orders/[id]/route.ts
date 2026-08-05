import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from "@/lib/services/orderEmailService";
import { returnUpdateTemplate, renderDBTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

import { syncPendingWebStoreOrders } from "@/lib/services/razorpaySyncService";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import { promoteMasterOrderToWebStoreOrder } from "@/lib/services/orderPromotionService";

async function resolveWebStoreOrder(id: string) {
  if (!id) return null;

  // 1. webStoreOrder.findUnique({ where: { id } }) (when id is a UUID)
  if (UUID_REGEX.test(id)) {
    try {
      const order = await prisma.webStoreOrder.findUnique({ where: { id } });
      if (order) return order;
    } catch {}
  }

  // 2. webStoreOrder.findUnique({ where: { orderNumber: id } })
  try {
    const order = await prisma.webStoreOrder.findUnique({ where: { orderNumber: id } });
    if (order) return order;
  } catch {}

  // 3. webStoreOrder.findFirst({ where: { razorpayOrderId: id } })
  try {
    const order = await prisma.webStoreOrder.findFirst({ where: { razorpayOrderId: id } });
    if (order) return order;
  } catch {}

  // 4. Fallback to master Order: order.findUnique({ where: { id } }) (cuid) OR order.findFirst(...)
  try {
    let mOrder = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: true },
    }).catch(() => null);

    if (!mOrder) {
      mOrder = await prisma.order.findFirst({
        where: {
          OR: [
            { internalOrderNumber: id },
            { shopifyOrderName: id },
            { razorpayOrderId: id },
            { note: { contains: `Local: ${id}` } }
          ]
        },
        include: { customer: true, items: true },
      });
    }

    if (mOrder) {
      return await promoteMasterOrderToWebStoreOrder(mOrder as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.error("[resolveWebStoreOrder] Master Order fallback error:", err);
  }

  return null;
}

// GET: Fetch details of a single web store order
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Attempt live Razorpay status sync for this single order if pending
    try {
      await syncPendingWebStoreOrders([params.id]);
    } catch (syncErr: unknown) {
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      console.warn("[Web Store Single Order GET] Sync warning:", msg);
    }

    const order = await resolveWebStoreOrder(params.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Enrich with failure reason from Order model if missing
    let failureReason = (order as unknown as Record<string, unknown>).paymentFailureReason as string | null || null;
    if (!failureReason && order.razorpayOrderId) {
      const matchingOrder = await prisma.order.findFirst({
        where: { razorpayOrderId: order.razorpayOrderId },
        select: { paymentFailureReason: true },
      });
      if (matchingOrder?.paymentFailureReason) {
        failureReason = matchingOrder.paymentFailureReason;
      }
    }

    const enrichedOrder = {
      ...order,
      paymentFailureReason: failureReason || (order.paymentStatus === "payment_pending" || order.paymentStatus === "pending" ? "awaiting_confirmation" : null),
    };

    return NextResponse.json({ order: enrichedOrder });
  } catch (error: unknown) {
    console.error("[Web Store Single Order GET] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: Update order details (fulfillment, tracking, notes, payment status)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      fulfillmentStatus,
      trackingNumber,
      trackingUrl,
      paymentStatus,
      notes
    } = body;

    // Check if order exists (resolving cuid/orderNumber/razorpayOrderId/uuid)
    const order = await resolveWebStoreOrder(params.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const oldFulfillment = order.fulfillmentStatus;

    // Build update object dynamically based on provided fields
    const data: Record<string, unknown> = {};
    if (fulfillmentStatus !== undefined) data.fulfillmentStatus = fulfillmentStatus;
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) data.trackingUrl = trackingUrl;
    if (paymentStatus !== undefined) data.paymentStatus = paymentStatus;
    if (notes !== undefined) data.notes = notes;

    const updatedOrder = await prisma.webStoreOrder.update({
      where: { id: order.id },
      data,
    });

    // Trigger email alerts on status changes asynchronously
    try {
      const orderPayload = {
        orderId: updatedOrder.orderNumber,
        customerEmail: updatedOrder.customerEmail,
        customerName: updatedOrder.customerName || "Customer",
        items: ((updatedOrder.items as unknown as Record<string, unknown>[]) || []).map((item) => ({
          name: (item.title as string) || (item.name as string) || "Product Item",
          size: (item.size as string) || 'N/A',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
          image: (item.image_url as string) || (item.image as string) || '',
          product_id: (item.product_id as string) || null,
          variant_title: (item.variant_id as string) || null,
        })),
        total: Number(updatedOrder.totalAmount),
        currency: 'INR',
        orderDate: new Date(updatedOrder.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }),
        paymentMethod: updatedOrder.paymentMethod,
      };

      // 1. Fulfillment status changed
      if (fulfillmentStatus !== undefined && fulfillmentStatus !== oldFulfillment) {
        const newStatus = fulfillmentStatus.toLowerCase();
        if (newStatus === 'shipped') {
          await sendOrderShippedEmail({
            ...orderPayload,
            trackingNumber: updatedOrder.trackingNumber || undefined,
            courier: 'Standard Shipping',
          });

          await prisma.emailLog.create({
            data: {
              recipientEmail: updatedOrder.customerEmail,
              recipientName: updatedOrder.customerName,
              subject: `Your order is on its way - ${updatedOrder.orderNumber}`,
              templateName: 'ORDER_SHIPPED',
              triggerEvent: 'web-store/orders/status-update',
              referenceId: updatedOrder.id,
              status: 'sent',
              sentBy: 'system',
            }
          });
        } else if (newStatus === 'delivered') {
          await sendOrderDeliveredEmail(orderPayload);

          await prisma.emailLog.create({
            data: {
              recipientEmail: updatedOrder.customerEmail,
              recipientName: updatedOrder.customerName,
              subject: `Your order has arrived - ${updatedOrder.orderNumber}`,
              templateName: 'ORDER_DELIVERED',
              triggerEvent: 'web-store/orders/status-update',
              referenceId: updatedOrder.id,
              status: 'sent',
              sentBy: 'system',
            }
          });
        } else if (newStatus === 'returned') {
          const fallback = returnUpdateTemplate({
            customerName: updatedOrder.customerName,
            orderId: updatedOrder.orderNumber,
            returnStatus: 'Returned',
            message: 'We have received your returned items and processed your update.',
          });

          const variables = {
            customerName: updatedOrder.customerName,
            customerEmail: updatedOrder.customerEmail,
            orderId: updatedOrder.orderNumber,
            total: `INR ${updatedOrder.totalAmount}`,
            totalPrice: `INR ${updatedOrder.totalAmount}`,
            currency: 'INR',
            orderDate: new Date(updatedOrder.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }),
            returnStatus: 'Returned',
            message: 'We have received your returned items and processed your update.',
            orderStatusUrl: `https://zicabella.com/account/orders`,
          };

          const { subject, html } = await renderDBTemplate('RETURN_REFUND', variables, () => fallback);

          await sendEmail({
            to: updatedOrder.customerEmail,
            subject: subject || `Return Update — #${updatedOrder.orderNumber} | Zica Bella`,
            html: html,
            text: `Update on your return for order ${updatedOrder.orderNumber}`,
          });

          await prisma.emailLog.create({
            data: {
              recipientEmail: updatedOrder.customerEmail,
              recipientName: updatedOrder.customerName,
              subject: subject || `Return Update — #${updatedOrder.orderNumber} | Zica Bella`,
              templateName: 'RETURN_REFUND',
              triggerEvent: 'web-store/orders/status-update',
              referenceId: updatedOrder.id,
              status: 'sent',
              sentBy: 'system',
            }
          });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Web Store Order Status Update Email Error]:", msg);
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: unknown) {
    console.error("[Web Store Single Order PATCH] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
