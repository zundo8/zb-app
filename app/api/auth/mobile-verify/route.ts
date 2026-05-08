import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { searchCustomerByPhone } from "@/lib/shopify-admin";
import { signAppToken } from "@/lib/appAuth";
import { SmsService } from "@/lib/services/sms.service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ error: "Phone and OTP are required" }, { status: 400 });
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "OTP must be exactly 6 digits" }, { status: 400 });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    const normalizedPhone = phoneDigits.slice(-10);

    let isVerified = false;

    // 1. Try Twilio Verify check first
    try {
      const verifyCheck = await SmsService.checkVerification(phone, otp);
      if (verifyCheck === true) {
        isVerified = true;
      }
    } catch (err: any) {
      console.log("[Mobile Verify] Twilio Verify check failed/skipped:", err.message);
    }

    // 2. Fallback to local DB check if not verified by Twilio Verify
    if (!isVerified) {
      const verification = await prisma.verificationCode.findFirst({
        where: {
          phone: { contains: normalizedPhone },
          code: otp,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (verification) {
        isVerified = true;
        // Delete the used code to prevent reuse
        await prisma.verificationCode.delete({
          where: { id: verification.id }
        }).catch(console.error);
      }
    }

    if (!isVerified) {
      // Log failed attempt
      await prisma.appLogin.create({
        data: {
          phone: phone,
          status: "FAILED",
          userAgent: req.headers.get("user-agent") || "Mobile App"
        }
      }).catch(console.error);

      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    // Success logic follows...
    // Also clean up any other expired codes for this phone
    await prisma.verificationCode.deleteMany({
      where: {
        phone: { contains: normalizedPhone },
        expiresAt: { lt: new Date() }
      }
    }).catch(() => {});

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

    // Success: Update last login and Log attempt
    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() }
    });

    await prisma.appLogin.create({
      data: {
        phone: fullPhone,
        status: "SUCCESS",
        userAgent: req.headers.get("user-agent") || "Mobile App"
      }
    });

    const token = signAppToken({
      customerId: customer.id,
      customerEmail: customer.email ?? null,
      customerPhone: customer.phone ?? null,
    });

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
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}
