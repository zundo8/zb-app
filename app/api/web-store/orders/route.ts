import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";
import { syncPendingWebStoreOrders } from "@/lib/services/razorpaySyncService";
import { assignFailedOrderNumber } from "@/lib/orderNumber";

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
    } else {
      where.paymentStatus = {
        notIn: ["payment_pending", "payment_failed", "pending", "failed", "cancelled", "FAILED"],
      };
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
  if (!orders || orders.length === 0) return [];

  // Step 1: Group and deduplicate by exact orderNumber or razorpayOrderId
  const uniqueByNumber = new Map<string, any>();

  for (const order of orders) {
    const numKey = (order.orderNumber || "").trim().toUpperCase();
    const rzpKey = (order.razorpayOrderId || "").trim();

    let existingKey = "";
    if (numKey && numKey !== "N/A") {
      existingKey = `NUM_${numKey}`;
    } else if (rzpKey) {
      existingKey = `RZP_${rzpKey}`;
    }

    if (existingKey) {
      const existing = uniqueByNumber.get(existingKey);
      if (!existing) {
        uniqueByNumber.set(existingKey, order);
      } else {
        const existingStatus = (existing.paymentStatus || "").toLowerCase();
        const currentStatus = (order.paymentStatus || "").toLowerCase();

        const statusRank = (s: string) => {
          if (s === "paid" || s === "cod_upfront_paid") return 3;
          if (s === "pending" || s === "open" || s === "payment_pending") return 2;
          return 1;
        };

        if (statusRank(currentStatus) > statusRank(existingStatus)) {
          uniqueByNumber.set(existingKey, order);
        } else if (statusRank(currentStatus) === statusRank(existingStatus)) {
          const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
          const currentTime = new Date(order.updatedAt || order.createdAt).getTime();
          if (currentTime > existingTime) {
            uniqueByNumber.set(existingKey, order);
          }
        }
      }
    } else {
      uniqueByNumber.set(`ID_${order.id}`, order);
    }
  }

  const dedupedList = Array.from(uniqueByNumber.values());

  // Step 2: Separate confirmed vs unconfirmed
  const confirmedOrders: any[] = [];
  const unconfirmedOrders: any[] = [];

  for (const order of dedupedList) {
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

  // Step 3: Collapse unconfirmed orders for customers with a confirmed order in the same session window
  const getCustomerKey = (o: any) => {
    const email = (o.customerEmail || "").toLowerCase().trim();
    const phone = (o.customerPhone || "").replace(/\D/g, "").slice(-10);
    return email || phone || o.id;
  };

  const finalOrders: any[] = [...confirmedOrders];

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

    // Generate a pending order number — real ZB number assigned at payment success
    let pendingOrderNumber: string;
    try {
      pendingOrderNumber = await assignFailedOrderNumber(prisma, { cause: 'pending' });
    } catch {
      pendingOrderNumber = `ZBPP${Date.now().toString().slice(-8)}`;
    }

    const normalizedPaymentMethod = paymentMethod.toLowerCase() === "cod" ? "cod" : "razorpay";

    const createdOrder = await prisma.webStoreOrder.create({
      data: {
        orderNumber: pendingOrderNumber,
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
