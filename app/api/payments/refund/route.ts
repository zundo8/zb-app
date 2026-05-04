/**
 * POST /api/payments/refund — Process a refund via Razorpay
 * 
 * Admin-only endpoint (protected by middleware).
 * Supports full and partial refunds.
 */

import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

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
    return new Razorpay({ key_id: shop.razorpayKeyId, key_secret: shop.razorpayKeySecret });
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payment_id, amount, reason } = body;

    if (!payment_id) {
      return NextResponse.json({ error: "payment_id is required" }, { status: 400 });
    }

    // Get Razorpay instance
    let razorpay = getRazorpayInstance();
    if (!razorpay) {
      razorpay = await getRazorpayFromDB();
    }
    if (!razorpay) {
      return NextResponse.json(
        { error: "Razorpay is not configured" },
        { status: 500 }
      );
    }

    // Process refund
    const refundOptions: any = {};
    if (amount && amount > 0) {
      refundOptions.amount = Math.round(amount * 100); // partial refund in paise
    }
    if (reason) {
      refundOptions.notes = { reason };
    }

    const refund = await razorpay.payments.refund(payment_id, refundOptions);

    // Update order in DB
    await prisma.order.updateMany({
      where: { razorpayPaymentId: payment_id },
      data: { paymentStatus: "refunded" },
    });

    console.log(`[Razorpay Refund] Refund ${refund.id} processed for payment ${payment_id}`);

    return NextResponse.json({
      refund_id: refund.id,
      status: refund.status,
      amount: refund.amount,
      payment_id: refund.payment_id,
    });
  } catch (error: any) {
    console.error("[Razorpay Refund] Error:", error);
    return NextResponse.json(
      { error: "Refund processing failed. Please try again." },
      { status: 500 }
    );
  }
}
