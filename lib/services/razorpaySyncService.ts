import prisma from "@/lib/db";
import { resolveRazorpayCredentials } from "@/lib/razorpay-credentials";
import Razorpay from "razorpay";

export interface SyncedOrderInfo {
  id: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  failureReason: string | null;
}

export interface SyncResult {
  updatedCount: number;
  syncedOrders: SyncedOrderInfo[];
}

export async function syncPendingWebStoreOrders(orderIds?: string[]): Promise<SyncResult> {
  const syncedOrders: SyncedOrderInfo[] = [];

  try {
    const creds = await resolveRazorpayCredentials().catch(() => null);
    if (!creds) {
      console.warn("[RazorpaySync] Razorpay credentials not configured, skipping sync.");
      return { updatedCount: 0, syncedOrders: [] };
    }

    const razorpay = new Razorpay({
      key_id: creds.key_id,
      key_secret: creds.key_secret,
    });

    // Build filter for pending orders
    const where: any = {
      razorpayOrderId: { not: null },
    };

    if (orderIds && orderIds.length > 0) {
      where.id = { in: orderIds };
    } else {
      where.paymentStatus = { in: ["pending", "payment_pending", "awaiting_confirmation"] };
    }

    const pendingOrders = await prisma.webStoreOrder.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    for (const order of pendingOrders) {
      if (!order.razorpayOrderId) continue;

      try {
        const rzpOrder: any = await razorpay.orders.fetch(order.razorpayOrderId);
        let paymentsList: any = null;
        try {
          paymentsList = await razorpay.orders.fetchPayments(order.razorpayOrderId);
        } catch {
          // ignore fetchPayments failure
        }

        const items: any[] = paymentsList?.items || [];
        const capturedPayment = items.find((p: any) => p.status === "captured");
        const failedPayments = items.filter((p: any) => p.status === "failed");
        const latestFailedPayment = failedPayments.length > 0 ? failedPayments[failedPayments.length - 1] : null;

        let newStatus: string | null = null;
        let newPaymentId: string | null = null;
        let failureReason: string | null = null;

        if (rzpOrder.status === "paid" || capturedPayment) {
          const isCOD = (order.paymentMethod || "").toLowerCase().trim() === "cod";
          newStatus = isCOD ? "cod_upfront_paid" : "paid";
          newPaymentId = capturedPayment?.id || order.razorpayPaymentId || null;
          failureReason = null;
        } else if (latestFailedPayment) {
          const rawReason =
            latestFailedPayment.error_description ||
            latestFailedPayment.error_reason ||
            latestFailedPayment.error_code ||
            "Payment failed";
          
          const rawCode = String(latestFailedPayment.error_code || "").toUpperCase();
          const rawDesc = String(latestFailedPayment.error_description || "").toLowerCase();

          if (
            rawCode === "BAD_REQUEST_ERROR" &&
            (rawDesc.includes("cancel") || rawDesc.includes("dismissed") || rawDesc.includes("closed"))
          ) {
            newStatus = "cancelled";
            failureReason = "payment_cancelled_by_user";
          } else {
            newStatus = "failed";
            failureReason = rawReason;
          }
        } else if (rzpOrder.status === "attempted") {
          newStatus = "failed";
          failureReason = "Payment attempt failed or was cancelled by customer";
        } else {
          // Order status is "created", check age
          const ageMs = Date.now() - new Date(order.createdAt).getTime();
          // Mark as failed if order is > 15 minutes old and uncaptured
          if (ageMs > 15 * 60 * 1000) {
            newStatus = "failed";
            failureReason = "payment_timed_out";
          }
        }

        if (
          newStatus &&
          (newStatus !== order.paymentStatus || failureReason !== order.paymentFailureReason)
        ) {
          const isCOD = (order.paymentMethod || "").toLowerCase().trim() === "cod";
          const finalPaymentStatus = isCOD && newStatus === "paid" ? "cod_upfront_paid" : newStatus;

          // 1. Update WebStoreOrder
          await prisma.webStoreOrder.update({
            where: { id: order.id },
            data: {
              paymentStatus: finalPaymentStatus,
              razorpayPaymentId: newPaymentId || order.razorpayPaymentId,
              paymentFailureReason: failureReason,
              ...(isCOD && (finalPaymentStatus === "cod_upfront_paid" || finalPaymentStatus === "paid") ? {
                codUpfrontPaid: Number(order.codUpfrontPaid) || 99,
                codUpfrontPaymentId: newPaymentId || order.razorpayPaymentId || null,
                notes: `COD Order (₹${Number(order.codUpfrontPaid) || 99} upfront fee paid via Razorpay) | Order: ${order.orderNumber}`
              } : {})
            },
          });

          // 2. Update matching Order in main Order table
          const matchingMainOrders = await prisma.order.findMany({
            where: { razorpayOrderId: order.razorpayOrderId }
          });

          for (const mOrder of matchingMainOrders) {
            const cleanedTags = (mOrder.tags || '')
              .split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => Boolean(t) && t !== 'payment_pending' && t !== 'Order creation in process')
              .concat(isCOD ? ['cod_upfront_paid'] : ['paid'])
              .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
              .join(', ');

            await prisma.order.update({
              where: { id: mOrder.id },
              data: {
                paymentStatus: finalPaymentStatus,
                status: finalPaymentStatus === "paid" || finalPaymentStatus === "cod_upfront_paid" ? "open" : (newStatus === "cancelled" ? "cancelled" : "payment_failed"),
                razorpayPaymentId: newPaymentId || undefined,
                paymentFailureReason: failureReason,
                cancelledAt: newStatus === "cancelled" || newStatus === "failed" ? new Date() : undefined,
                cancelledBy: newStatus === "cancelled" ? "customer" : undefined,
                tags: cleanedTags,
              },
            });
          }

          syncedOrders.push({
            id: order.id,
            orderNumber: order.orderNumber,
            oldStatus: order.paymentStatus,
            newStatus: finalPaymentStatus,
            failureReason,
          });
        }
      } catch (orderErr: any) {
        console.error(`[RazorpaySync] Error syncing order ${order.orderNumber}:`, orderErr?.message);
      }
    }
  } catch (err: any) {
    console.error("[RazorpaySync] Service error:", err?.message);
  }

  return {
    updatedCount: syncedOrders.length,
    syncedOrders,
  };
}
