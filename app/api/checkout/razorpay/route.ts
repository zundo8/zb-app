/**
 * POST /api/checkout/razorpay — Create a Razorpay order
 * 
 * Called from the React Native checkout flow.
 * Returns order_id, amount, and key_id for the client SDK.
 * Secret key is NEVER exposed in the response.
 */

import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import prisma from "@/lib/db";

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
  try {
    const body = await req.json();
    const { amount, currency, receipt, notes } = body;

    // Validate required fields
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a positive number." },
        { status: 400 }
      );
    }

    // Try env vars first, then DB fallback
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
      // If we got keys from DB, also get the public key
      const shop = await prisma.shop.findFirst({ select: { razorpayKeyId: true } });
      keyId = shop?.razorpayKeyId || keyId;
    }

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency: currency || "INR",
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {},
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      razorpay_order_id: order.id,
      id: order.id, // backward compat
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      keyId: keyId, // backward compat
    });
  } catch (error: any) {
    console.error("[Razorpay] Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
