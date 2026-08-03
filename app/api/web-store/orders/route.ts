import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";
import { syncPendingWebStoreOrders } from "@/lib/services/razorpaySyncService";

export const dynamic = "force-dynamic";

// GET: Fetch web store orders with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto sync pending Razorpay orders in background before listing
    try {
      await syncPendingWebStoreOrders();
    } catch (syncErr: any) {
      console.warn("[Web Store Orders GET] Auto-sync warning:", syncErr?.message);
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
      where.paymentMethod = {
        in: [paymentMethod.toLowerCase(), paymentMethod.toUpperCase()],
      };
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

    // Enrich with failure reason from Order model if missing on webStoreOrder
    const enrichedOrders = await Promise.all(
      orders.map(async (o: any) => {
        let failureReason = o.paymentFailureReason || null;
        if (!failureReason && o.razorpayOrderId) {
          const matchingOrder = await prisma.order.findFirst({
            where: { razorpayOrderId: o.razorpayOrderId },
            select: { paymentFailureReason: true },
          });
          if (matchingOrder?.paymentFailureReason) {
            failureReason = matchingOrder.paymentFailureReason;
          }
        }
        return {
          ...o,
          paymentFailureReason: failureReason || (o.paymentStatus === "payment_pending" || o.paymentStatus === "pending" ? "awaiting_confirmation" : null),
        };
      })
    );

    // Deduplicate order attempts (collapse multiple failed attempts and hide abandoned draft pre-creates)
    const deduplicatedOrders = deduplicateWebStoreOrders(enrichedOrders);

    return NextResponse.json({ orders: deduplicatedOrders });
  } catch (error: any) {
    console.error("[Web Store Orders GET] Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

function deduplicateWebStoreOrders(orders: any[]) {
  const confirmedOrders: any[] = [];
  const unconfirmedOrders: any[] = [];

  for (const order of orders) {
    const pStatus = (order.paymentStatus || "").toLowerCase().trim();
    const pMethod = (order.paymentMethod || "").toLowerCase().trim();
    const isPaid = pStatus === "paid" || pStatus === "cod_upfront_paid" || pStatus === "refunded";
    const isCOD = pMethod === "cod";

    if (isPaid || isCOD) {
      confirmedOrders.push(order);
    } else {
      unconfirmedOrders.push(order);
    }
  }

  const finalOrders: any[] = [...confirmedOrders];

  const getCustomerKey = (o: any) => {
    const email = (o.customerEmail || "").toLowerCase().trim();
    const phone = (o.customerPhone || "").replace(/\D/g, "").slice(-10);
    return email || phone || o.id;
  };

  const unconfirmedByCustomer: { [key: string]: any[] } = {};
  for (const uOrder of unconfirmedOrders) {
    const key = getCustomerKey(uOrder);
    if (!unconfirmedByCustomer[key]) {
      unconfirmedByCustomer[key] = [];
    }
    unconfirmedByCustomer[key].push(uOrder);
  }

  for (const key of Object.keys(unconfirmedByCustomer)) {
    const customerUnconfirmed = unconfirmedByCustomer[key];
    const customerConfirmed = confirmedOrders.filter(
      (cOrder) => getCustomerKey(cOrder) === key
    );

    customerUnconfirmed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const filteredUnconfirmedForCustomer: any[] = [];

    for (const uOrder of customerUnconfirmed) {
      const uTime = new Date(uOrder.createdAt).getTime();

      // Check if a confirmed order exists for this customer around the same attempt time window (-30m to +2h)
      const hasMatchingConfirmed = customerConfirmed.some((cOrder) => {
        const cTime = new Date(cOrder.createdAt).getTime();
        const diffMs = cTime - uTime;
        return diffMs >= -30 * 60 * 1000 && diffMs <= 2 * 60 * 60 * 1000;
      });

      if (hasMatchingConfirmed) {
        continue;
      }

      // Check if we already kept a more recent unconfirmed attempt for this session (within 2 hours)
      const alreadyKeptSession = filteredUnconfirmedForCustomer.some((kOrder) => {
        const kTime = new Date(kOrder.createdAt).getTime();
        return Math.abs(kTime - uTime) <= 2 * 60 * 60 * 1000;
      });

      if (!alreadyKeptSession) {
        filteredUnconfirmedForCustomer.push(uOrder);
      }
    }

    finalOrders.push(...filteredUnconfirmedForCustomer);
  }

  finalOrders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return finalOrders;
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
