import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from "@/lib/services/orderEmailService";
import { returnUpdateTemplate, renderDBTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    if (!UUID_REGEX.test(params.id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const order = await prisma.webStoreOrder.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error("[Web Store Single Order GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
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

    if (!UUID_REGEX.test(params.id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const body = await request.json();
    const {
      fulfillmentStatus,
      trackingNumber,
      trackingUrl,
      paymentStatus,
      notes
    } = body;

    // Check if order exists
    const order = await prisma.webStoreOrder.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const oldFulfillment = order.fulfillmentStatus;
    const oldPayment = order.paymentStatus;

    // Build update object dynamically based on provided fields
    const data: any = {};
    if (fulfillmentStatus !== undefined) data.fulfillmentStatus = fulfillmentStatus;
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) data.trackingUrl = trackingUrl;
    if (paymentStatus !== undefined) data.paymentStatus = paymentStatus;
    if (notes !== undefined) data.notes = notes;

    const updatedOrder = await prisma.webStoreOrder.update({
      where: { id: params.id },
      data,
    });

    // Trigger email alerts on status changes asynchronously
    try {
      const orderPayload = {
        orderId: updatedOrder.orderNumber,
        customerEmail: updatedOrder.customerEmail,
        customerName: updatedOrder.customerName || "Customer",
        items: (updatedOrder.items as any[]).map((item: any) => ({
          name: item.title || item.name || "Product Item",
          size: item.size || 'N/A',
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
          image: item.image_url || item.image || '',
          product_id: item.product_id || null,
          variant_title: item.variant_id || null,
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
    } catch (e: any) {
      console.error("[Web Store Order Status Update Email Error]:", e.message);
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error("[Web Store Single Order PATCH] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
