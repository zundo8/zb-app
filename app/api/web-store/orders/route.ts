import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { assignFailedOrderNumber } from "@/lib/orderNumber";

import { promoteMasterOrderToWebStoreOrder } from "@/lib/services/orderPromotionService";

export const dynamic = "force-dynamic";

// GET: Fetch web store orders with filters
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "all";
    const query = searchParams.get("query") || "";
    const fulfillmentStatus = searchParams.get("fulfillment_status") || "";
    const paymentStatus = searchParams.get("payment_status") || "";
    const paymentMethod = searchParams.get("payment_method") || "";
    const startDateStr = searchParams.get("start_date");
    const endDateStr = searchParams.get("end_date");
    
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(isNaN(rawLimit) || rawLimit <= 0 ? 20 : rawLimit, 20);
    const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    // Construct database filters
    const andConditions: Prisma.WebStoreOrderWhereInput[] = [];

    // Search query filter
    if (query) {
      andConditions.push({
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { customerEmail: { contains: query, mode: "insensitive" } },
          { customerPhone: { contains: query, mode: "insensitive" } },
        ]
      });
    }

    // Status filters
    if (fulfillmentStatus && fulfillmentStatus !== "all") {
      andConditions.push({ fulfillmentStatus });
    }
    if (paymentStatus && paymentStatus !== "all") {
      if (paymentStatus === "paid") {
        andConditions.push({ paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "PAID", "COD_UPFRONT_PAID", "PARTIALLY_PAID"] } });
      } else if (paymentStatus === "cod_upfront_paid" || paymentStatus === "partially_paid") {
        andConditions.push({
          OR: [
            { paymentStatus: { in: ["cod_upfront_paid", "partially_paid", "COD_UPFRONT_PAID", "PARTIALLY_PAID"] } },
            { codUpfrontPaid: { gt: 0 } }
          ]
        });
      } else if (paymentStatus === "pending") {
        andConditions.push({ paymentStatus: { in: ["pending", "payment_pending", "PENDING", "PAYMENT_PENDING"] } });
      } else if (paymentStatus === "failed") {
        andConditions.push({ paymentStatus: { in: ["failed", "payment_failed", "FAILED", "PAYMENT_FAILED"] } });
      } else if (paymentStatus === "cancelled") {
        andConditions.push({ paymentStatus: { in: ["cancelled", "CANCELLED", "canceled", "CANCELED"] } });
      } else if (paymentStatus === "refunded") {
        andConditions.push({ paymentStatus: { in: ["refunded", "REFUNDED"] } });
      } else {
        andConditions.push({ paymentStatus });
      }
    } else if (view === "processed") {
      andConditions.push({
        OR: [
          { paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "PAID", "COD_UPFRONT_PAID", "PARTIALLY_PAID"] } },
          { codUpfrontPaid: { gt: 0 } }
        ]
      });
    }
    if (paymentMethod && paymentMethod !== "all") {
      andConditions.push({
        paymentMethod: {
          in: [paymentMethod.toLowerCase(), paymentMethod.toUpperCase()],
        }
      });
    }

    // Date range filter
    if (startDateStr || endDateStr) {
      const createdAtFilter: { gte?: Date; lte?: Date } = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        if (!isNaN(start.getTime())) {
          createdAtFilter.gte = start;
        }
      }
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          createdAtFilter.lte = endDate;
        }
      }
      if (createdAtFilter.gte || createdAtFilter.lte) {
        andConditions.push({ createdAt: createdAtFilter });
      }
    }

    const where: Prisma.WebStoreOrderWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const [orders, total] = await Promise.all([
      prisma.webStoreOrder.findMany({
        where: where as Prisma.WebStoreOrderWhereInput,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.webStoreOrder.count({ where: where as Prisma.WebStoreOrderWhereInput }),
    ]);

    // Page-scoped cross-lookup in master Order table to reconcile missing or outdated entries for current page
    const pageOrderNumbers = orders.map((o: Record<string, unknown>) => o.orderNumber as string).filter(Boolean);
    const pageRzpIds = orders.map((o: Record<string, unknown>) => o.razorpayOrderId as string).filter(Boolean);

    const masterOrClauses: Record<string, unknown>[] = [];
    if (pageRzpIds.length > 0) {
      masterOrClauses.push({ razorpayOrderId: { in: pageRzpIds } });
    }
    if (pageOrderNumbers.length > 0) {
      masterOrClauses.push({ internalOrderNumber: { in: pageOrderNumbers } });
      masterOrClauses.push({ shopifyOrderName: { in: pageOrderNumbers } });
    }
    // Indexed cross-lookup clauses only (razorpayOrderId, internalOrderNumber, shopifyOrderName)

    const masterWebOrders = await prisma.order.findMany({
      where: {
        OR: [
          ...(masterOrClauses.length > 0 ? (masterOrClauses as Prisma.OrderWhereInput[]) : []),
          { paymentStatus: { in: ["paid", "cod_upfront_paid", "partially_paid", "approved", "PAID", "COD_UPFRONT_PAID", "PARTIALLY_PAID"] } }
        ]
      },
      take: 40,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: true },
    });

    // Merge master orders into webStoreOrders map matching on orderNumber, razorpayOrderId, AND razorpayPaymentId
    const existingOrderKeys = new Set<string>();
    for (const o of orders) {
      if (o.id) existingOrderKeys.add((o.id as string).toUpperCase());
      if (o.orderNumber) existingOrderKeys.add((o.orderNumber as string).toUpperCase());
      if (o.razorpayOrderId) existingOrderKeys.add((o.razorpayOrderId as string).toUpperCase());
      if (o.razorpayPaymentId) existingOrderKeys.add((o.razorpayPaymentId as string).toUpperCase());
      if (o.notes) {
        const localMatch = (o.notes as string).match(/Local:\s*([^\s\n]+)/i);
        if (localMatch) existingOrderKeys.add(localMatch[1].toUpperCase());
        const shopifyMatch = (o.notes as string).match(/Shopify:\s*([^\s\n]+)/i);
        if (shopifyMatch) existingOrderKeys.add(shopifyMatch[1].toUpperCase());
      }
    }

    const reconciledOrders: Record<string, unknown>[] = [...orders];

    for (const mOrder of masterWebOrders) {
      const idKey = mOrder.id ? mOrder.id.toUpperCase() : "";
      const intNumKey = mOrder.internalOrderNumber ? mOrder.internalOrderNumber.toUpperCase() : "";
      const shopNumKey = mOrder.shopifyOrderName ? mOrder.shopifyOrderName.toUpperCase() : "";
      const shopIdKey = mOrder.shopifyOrderId ? mOrder.shopifyOrderId.toUpperCase() : "";
      const rzpOrderKey = mOrder.razorpayOrderId ? mOrder.razorpayOrderId.toUpperCase() : "";
      const rzpPayKey = mOrder.razorpayPaymentId ? mOrder.razorpayPaymentId.toUpperCase() : "";

      const alreadyIncluded = 
        (idKey && existingOrderKeys.has(idKey)) ||
        (intNumKey && existingOrderKeys.has(intNumKey)) ||
        (shopNumKey && existingOrderKeys.has(shopNumKey)) ||
        (shopIdKey && existingOrderKeys.has(shopIdKey)) ||
        (rzpOrderKey && existingOrderKeys.has(rzpOrderKey)) ||
        (rzpPayKey && existingOrderKeys.has(rzpPayKey));

      const isSuccessful = ["paid", "cod_upfront_paid", "partially_paid", "approved", "PAID", "COD_UPFRONT_PAID", "PARTIALLY_PAID"].includes((mOrder.paymentStatus || "").toString());

      if (!alreadyIncluded && (mOrder.internalOrderNumber || mOrder.shopifyOrderName) && isSuccessful) {
        try {
          const promoted = await promoteMasterOrderToWebStoreOrder(mOrder);
          if (promoted) {
            existingOrderKeys.add(promoted.id.toUpperCase());
            existingOrderKeys.add(promoted.orderNumber.toUpperCase());
            if (promoted.razorpayOrderId) existingOrderKeys.add(promoted.razorpayOrderId.toUpperCase());
            if (promoted.razorpayPaymentId) existingOrderKeys.add(promoted.razorpayPaymentId.toUpperCase());
            reconciledOrders.push(promoted as unknown as Record<string, unknown>);
          }
        } catch (pErr: unknown) {
          const msg = pErr instanceof Error ? pErr.message : String(pErr);
          console.warn(`[Web Store Orders GET] Skipping promotion error for master order ${mOrder.id}:`, msg);
        }
      }
    }

    // Batched lookup for payment failure reason from Order model to eliminate N+1 queries
    const rzpIdsToFetch = reconciledOrders.map((o: Record<string, unknown>) => o.razorpayOrderId as string).filter(Boolean);
    const failureReasonMap = new Map<string, string>();

    if (rzpIdsToFetch.length > 0) {
      const matchingOrders = await prisma.order.findMany({
        where: { razorpayOrderId: { in: rzpIdsToFetch } },
        select: { razorpayOrderId: true, paymentFailureReason: true },
      });
      matchingOrders.forEach((m: { razorpayOrderId: string | null; paymentFailureReason: string | null }) => {
        if (m.razorpayOrderId && m.paymentFailureReason) {
          failureReasonMap.set(m.razorpayOrderId, m.paymentFailureReason);
        }
      });
    }

    const enrichedOrders = reconciledOrders.map((o: Record<string, unknown>) => {
      let failureReason = (o.paymentFailureReason as string) || null;
      const rzpId = o.razorpayOrderId as string | undefined;
      const pStatus = o.paymentStatus as string | undefined;
      if (!failureReason && rzpId) {
        failureReason = failureReasonMap.get(rzpId) || null;
      }
      return {
        ...o,
        paymentFailureReason: failureReason || (pStatus === "payment_pending" || pStatus === "pending" ? "awaiting_confirmation" : null),
      };
    });

    // Deduplicate order attempts
    const deduplicatedOrders = deduplicateWebStoreOrders(enrichedOrders);
    const updatedTotal = await prisma.webStoreOrder.count({ where: where as Prisma.WebStoreOrderWhereInput });
    const finalTotal = Math.max(updatedTotal, deduplicatedOrders.length);

    return NextResponse.json({
      orders: deduplicatedOrders,
      total: finalTotal,
      hasMore: offset + limit < finalTotal,
    });
  } catch (error: unknown) {
    console.error("[Web Store Orders GET] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function deduplicateWebStoreOrders(orders: Record<string, unknown>[]) {
  if (!orders || orders.length === 0) return [];

  // Step 1: Group and deduplicate by exact orderNumber or razorpayOrderId
  const uniqueByNumber = new Map<string, Record<string, unknown>>();

  for (const order of orders) {
    const orderNumStr = (order.orderNumber as string) || "";
    const rzpOrderStr = (order.razorpayOrderId as string) || "";
    const numKey = orderNumStr.trim().toUpperCase();
    const rzpKey = rzpOrderStr.trim();

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
        const existingStatus = ((existing.paymentStatus as string) || "").toLowerCase();
        const currentStatus = ((order.paymentStatus as string) || "").toLowerCase();

        const statusRank = (s: string) => {
          if (s === "paid" || s === "cod_upfront_paid") return 3;
          if (s === "pending" || s === "open" || s === "payment_pending") return 2;
          return 1;
        };

        if (statusRank(currentStatus) > statusRank(existingStatus)) {
          uniqueByNumber.set(existingKey, order);
        } else if (statusRank(currentStatus) === statusRank(existingStatus)) {
          const existingDate = (existing.updatedAt || existing.createdAt) as string | Date;
          const currentDate = (order.updatedAt || order.createdAt) as string | Date;
          const existingTime = new Date(existingDate).getTime();
          const currentTime = new Date(currentDate).getTime();
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
  const confirmedOrders: Record<string, unknown>[] = [];
  const unconfirmedOrders: Record<string, unknown>[] = [];

  for (const order of dedupedList) {
    const pStatus = ((order.paymentStatus as string) || "").toLowerCase().trim();
    const pMethod = ((order.paymentMethod as string) || "").toLowerCase().trim();
    const orderNum = (order.orderNumber as string) || "";
    const isRealOrder = 
      pStatus === "paid" || 
      pStatus === "cod_upfront_paid" || 
      pStatus === "refunded" || 
      pStatus === "cancelled" ||
      (orderNum && orderNum !== "N/A" && !orderNum.startsWith("ZBPP") && !orderNum.startsWith("ZBPF"));
    const isCOD = pMethod === "cod";

    if (isRealOrder || isCOD) {
      confirmedOrders.push(order);
    } else {
      unconfirmedOrders.push(order);
    }
  }

  // Step 3: Collapse unconfirmed orders for customers with a confirmed order in the same session window
  const getCustomerKey = (o: Record<string, unknown>) => {
    const email = ((o.customerEmail as string) || "").toLowerCase().trim();
    const phone = ((o.customerPhone as string) || "").replace(/\D/g, "").slice(-10);
    return email || phone || (o.id as string);
  };

  const finalOrders: Record<string, unknown>[] = [...confirmedOrders];

  const unconfirmedByCustomer: { [key: string]: Record<string, unknown>[] } = {};
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
      (a, b) => new Date(b.createdAt as string | Date).getTime() - new Date(a.createdAt as string | Date).getTime()
    );

    const filteredUnconfirmedForCustomer: Record<string, unknown>[] = [];

    for (const uOrder of customerUnconfirmed) {
      const uTime = new Date(uOrder.createdAt as string | Date).getTime();

      // Check if a confirmed order exists for this customer around the same attempt time window (-30m to +2h)
      const hasMatchingConfirmed = customerConfirmed.some((cOrder) => {
        const cTime = new Date(cOrder.createdAt as string | Date).getTime();
        const diffMs = cTime - uTime;
        return diffMs >= -30 * 60 * 1000 && diffMs <= 2 * 60 * 60 * 1000;
      });

      if (hasMatchingConfirmed) {
        continue;
      }

      // Check if we already kept a more recent unconfirmed attempt for this session (within 2 hours)
      const alreadyKeptSession = filteredUnconfirmedForCustomer.some((kOrder) => {
        const kTime = new Date(kOrder.createdAt as string | Date).getTime();
        return Math.abs(kTime - uTime) <= 2 * 60 * 60 * 1000;
      });

      if (!alreadyKeptSession) {
        filteredUnconfirmedForCustomer.push(uOrder);
      }
    }

    finalOrders.push(...filteredUnconfirmedForCustomer);
  }

  finalOrders.sort(
    (a, b) => new Date(b.createdAt as string | Date).getTime() - new Date(a.createdAt as string | Date).getTime()
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
  } catch (error: unknown) {
    console.error("[Web Store Orders POST] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
