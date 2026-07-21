import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpayOrderId, localOrderId, reason } = body;

    if (!razorpayOrderId && !localOrderId) {
      return NextResponse.json({ error: "Order ID missing" }, { status: 400 });
    }

    const failureReason = reason || "payment_cancelled_by_user";
    const isCancelled = failureReason === "payment_cancelled_by_user";

    // 1. Update Order in Prisma if present
    if (razorpayOrderId || localOrderId) {
      const whereCondition = razorpayOrderId
        ? { razorpayOrderId }
        : { id: localOrderId };

      await prisma.order.updateMany({
        where: whereCondition,
        data: {
          paymentStatus: isCancelled ? "cancelled" : "failed",
          status: isCancelled ? "cancelled" : "FAILED",
          paymentFailureReason: failureReason,
          cancelledAt: isCancelled ? new Date() : undefined,
          cancelledBy: isCancelled ? "customer" : undefined,
        },
      });
    }

    // 2. Update WebStoreOrder in Prisma if present
    if (razorpayOrderId) {
      await prisma.webStoreOrder.updateMany({
        where: { razorpayOrderId },
        data: {
          paymentStatus: isCancelled ? "cancelled" : "failed",
          paymentFailureReason: failureReason,
        },
      });
    }

    console.log(`[Checkout Cancel] Updated order(s) for Razorpay Order ${razorpayOrderId || localOrderId} with reason: ${failureReason}`);

    return NextResponse.json({ success: true, reason: failureReason });
  } catch (error: any) {
    console.error("[Checkout Cancel Error]:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
