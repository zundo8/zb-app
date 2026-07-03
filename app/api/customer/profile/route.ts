import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    if (whereClause.OR.length === 0) {
      return NextResponse.json({ error: "No valid user identifier" }, { status: 400 });
    }

    let customer = await prisma.customer.findFirst({
      where: whereClause,
      include: {
        orders: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 5
        },
        communityMember: true
      }
    });

    // If customer has no name or orders, try a quick sync from Shopify
    if (customer && (!customer.name || customer.name === 'New User') && customer.phone) {
      try {
        const { searchCustomerByPhone } = await import('@/lib/shopify-admin');
        const shopifyCustomer = await searchCustomerByPhone(customer.phone);
        if (shopifyCustomer) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
              name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || undefined,
              email: shopifyCustomer.email || undefined,
              ordersCount: shopifyCustomer.orders_count,
              totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
            },
            include: {
              orders: {
                include: {
                  items: {
                    include: {
                      product: true
                    }
                  }
                },
                orderBy: { createdAt: "desc" },
                take: 5
              },
              communityMember: true
            }
          });
        }
      } catch (e) {
        console.error("Profile sync-on-get error:", e);
      }
    }

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Load active and historic return & exchange requests for the customer
    const returnRequests = await prisma.returnRequest.findMany({
      where: { customerId: customer.id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const exchangeRequests = await prisma.exchangeRequest.findMany({
      where: { customerId: customer.id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Helper to find matching WebStoreOrder and get proper sequence order number (#ZB40001)
    async function enrichOrderNumber(orderObj: any) {
      if (!orderObj) return null;
      let webStoreOrder = null;
      if (orderObj.razorpayOrderId) {
        webStoreOrder = await prisma.webStoreOrder.findFirst({
          where: { razorpayOrderId: orderObj.razorpayOrderId }
        });
      }
      if (!webStoreOrder) {
        webStoreOrder = await prisma.webStoreOrder.findFirst({
          where: {
            notes: {
              contains: `Local: ${orderObj.id}`
            }
          }
        });
      }
      if (!webStoreOrder && orderObj.shopifyOrderId) {
        webStoreOrder = await prisma.webStoreOrder.findFirst({
          where: {
            notes: {
              contains: `Shopify: ${orderObj.shopifyOrderId}`
            }
          }
        });
      }
      return webStoreOrder?.orderNumber || (orderObj.shopifyOrderId && !orderObj.shopifyOrderId.startsWith('app_pending_') ? orderObj.shopifyOrderId : `#ZB${orderObj.id.slice(-5).toUpperCase()}`);
    }

    // Enrich all customer orders
    const enrichedOrders = await Promise.all(
      (customer.orders || []).map(async (o: any) => {
        const orderNumber = await enrichOrderNumber(o);
        return { ...o, orderNumber };
      })
    );

    // Enrich return requests orders
    const enrichedReturnRequests = await Promise.all(
      returnRequests.map(async (req: any) => {
        const orderNumber = await enrichOrderNumber(req.order);
        return {
          ...req,
          order: {
            ...req.order,
            orderNumber
          }
        };
      })
    );

    // Enrich exchange requests orders
    const enrichedExchangeRequests = await Promise.all(
      exchangeRequests.map(async (req: any) => {
        const orderNumber = await enrichOrderNumber(req.order);
        return {
          ...req,
          order: {
            ...req.order,
            orderNumber
          }
        };
      })
    );

    const finalCustomer = {
      ...customer,
      orders: enrichedOrders,
      returnRequests: enrichedReturnRequests,
      exchangeRequests: enrichedExchangeRequests
    };

    return NextResponse.json({ customer: finalCustomer });
  } catch (error: any) {
    console.error("Fetch Profile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, region, image, storeCreditPreference, emailOptedOut, whatsappOptedOut, smsOptedOut } = body;

    const whereClause: any = { OR: [] };
    if (session.user.email) {
      whereClause.OR.push({ email: session.user.email });
    }
    const userId = (session.user as any).id;
    if (userId) {
      whereClause.OR.push({ id: userId });
    }

    if (whereClause.OR.length === 0) {
      return NextResponse.json({ error: "No valid user identifier" }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: name !== undefined ? name : undefined,
        region: region !== undefined ? region : undefined,
        image: image !== undefined ? image : undefined,
        storeCreditPreference: storeCreditPreference !== undefined ? storeCreditPreference : undefined,
        emailOptedOut: emailOptedOut !== undefined ? emailOptedOut : undefined,
        whatsappOptedOut: whatsappOptedOut !== undefined ? whatsappOptedOut : undefined,
        smsOptedOut: smsOptedOut !== undefined ? smsOptedOut : undefined,
      }
    });

    return NextResponse.json({ customer: updatedCustomer });
  } catch (error: any) {
    console.error("Update Profile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
