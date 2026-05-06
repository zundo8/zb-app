import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { searchCustomerByPhone } from "@/lib/shopify-admin";
import { signAppToken } from "@/lib/appAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (otp !== "123456") {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    const normalizedPhone = phoneDigits.slice(-10);
    const fullPhone = `+${phoneDigits}`;

    // Get default shop for context
    let shop = await prisma.shop.findFirst();
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          domain: process.env.SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com",
          accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
        }
      });
    }

    // Always try to fetch latest from Shopify first
    let shopifyCustomer = null;
    try {
      shopifyCustomer = await searchCustomerByPhone(fullPhone);
      if (!shopifyCustomer) shopifyCustomer = await searchCustomerByPhone(phoneDigits);
      if (!shopifyCustomer) shopifyCustomer = await searchCustomerByPhone(normalizedPhone);
    } catch (e) {
      console.error("Shopify search error:", e);
    }

    let customer;

    if (shopifyCustomer) {
      // Sync local DB with Shopify data
      customer = await prisma.customer.upsert({
        where: { shopifyId: String(shopifyCustomer.id) },
        create: {
          shopifyId: String(shopifyCustomer.id),
          shopId: shop.id,
          email: shopifyCustomer.email,
          name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || "User",
          phone: shopifyCustomer.phone || fullPhone,
          ordersCount: shopifyCustomer.orders_count || 0,
          totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
        },
        update: {
          email: shopifyCustomer.email || undefined,
          name: `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || undefined,
          phone: shopifyCustomer.phone || undefined,
          ordersCount: shopifyCustomer.orders_count || 0,
          totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
        },
        include: { communityMember: true }
      });
    } else {
      // Look for a local-only customer
      customer = await prisma.customer.findFirst({
        where: { 
          OR: [
            { phone: fullPhone },
            { phone: phoneDigits },
            { phone: { contains: normalizedPhone } }
          ]
        },
        include: { communityMember: true }
      });

      if (!customer) {
        // Create new local guest
        customer = await prisma.customer.create({
          data: {
            phone: fullPhone,
            shopId: shop.id,
            shopifyId: `mobile_${Date.now()}`,
            name: "New User",
          },
          include: { communityMember: true }
        });
      }
    }

    const token = signAppToken({
      customerId: customer.id,
      customerEmail: customer.email ?? null,
      customerPhone: customer.phone ?? null,
    });
    // #region agent log
    fetch('http://127.0.0.1:7424/ingest/50560bdb-f431-4214-80ff-aed57193ade4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ff929'},body:JSON.stringify({sessionId:'7ff929',runId:'api-auth-pre',hypothesisId:'H2',location:'app/api/auth/mobile-verify/route.ts:POST',message:'mobile-verify issued token',data:{tokenLen:token.length,hasCustomerId:!!customer?.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return NextResponse.json({ 
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        image: (customer as any).image,
        isCommunityMember: !!customer.communityMember
      },
      token,
    });
  } catch (error: any) {
    console.error("Mobile verify error:", error);
    // #region agent log
    fetch('http://127.0.0.1:7424/ingest/50560bdb-f431-4214-80ff-aed57193ade4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7ff929'},body:JSON.stringify({sessionId:'7ff929',runId:'api-auth-pre',hypothesisId:'H2',location:'app/api/auth/mobile-verify/route.ts:catch',message:'mobile-verify error',data:{err:String(error?.message||error)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
