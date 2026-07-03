import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: Fetch web store orders with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const fulfillmentStatus = searchParams.get("fulfillment_status") || "";
    const paymentStatus = searchParams.get("payment_status") || "";
    const paymentMethod = searchParams.get("payment_method") || "";
    const startDateStr = searchParams.get("start_date");
    const endDateStr = searchParams.get("end_date");
    
    // Construct database filters
    const where: any = {};

    // Search query filter
    if (query) {
      where.OR = [
        { orderNumber: { contains: query, mode: "insensitive" } },
        { customerName: { contains: query, mode: "insensitive" } },
        { customerEmail: { contains: query, mode: "insensitive" } },
        { customerPhone: { contains: query, mode: "insensitive" } },
      ];
    }

    // Status filters
    if (fulfillmentStatus && fulfillmentStatus !== "all") {
      where.fulfillmentStatus = fulfillmentStatus;
    }
    if (paymentStatus && paymentStatus !== "all") {
      where.paymentStatus = paymentStatus;
    }
    if (paymentMethod && paymentMethod !== "all") {
      where.paymentMethod = paymentMethod;
    }

    // Date range filter
    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        where.createdAt.gte = new Date(startDateStr);
      }
      if (endDateStr) {
        // Set end date to end of the day (23:59:59)
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const orders = await prisma.webStoreOrder.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("[Web Store Orders GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// POST: Create a web store order (called by storefront checkout)
export async function POST(request: Request) {
  try {
    // Note: Public storefront route. Authentication is typically storefront-based rather than admin-based,
    // so we do not block POST orders with admin sessions.
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      subtotal,
      shippingCharge,
      discountCode,
      discountAmount,
      totalAmount,
      paymentMethod,
      razorpayOrderId,
      notes
    } = body;

    // Validate essential fields
    if (!customerName || !customerEmail || !items || !totalAmount || !paymentMethod) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate a fallback order number — DB trigger will override on Postgres
    const fallbackOrderNumber = `ZB-WEB-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Normalize paymentMethod to valid DB constraint values ('razorpay' or 'cod')
    const normalizedPaymentMethod = paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay";

    const createdOrder = await prisma.webStoreOrder.create({
      data: {
        orderNumber: fallbackOrderNumber, // DB trigger will override on Postgres; fallback used on other DBs
        customerName,
        customerEmail,
        customerPhone: customerPhone || "",
        shippingAddress: shippingAddress || {},
        items: items || [],
        subtotal: Number(subtotal || totalAmount) || 0,
        shippingCharge: Number(shippingCharge) || 0,
        discountCode: discountCode || null,
        discountAmount: Number(discountAmount) || 0,
        totalAmount: Number(totalAmount) || 0,
        paymentStatus: "pending",
        paymentMethod: normalizedPaymentMethod,
        razorpayOrderId: razorpayOrderId || null,
        fulfillmentStatus: "unfulfilled",
        notes: notes || null,
        source: "web",
      },
    });

    // Re-fetch order to fetch generated orderNumber from DB trigger
    const finalOrder = await prisma.webStoreOrder.findUnique({
      where: { id: createdOrder.id },
    });

    return NextResponse.json({ success: true, order: finalOrder });
  } catch (error: any) {
    console.error("[Web Store Orders POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
