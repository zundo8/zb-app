import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { searchCustomerByPhone } from "@/lib/shopify-admin";
import { signAppToken } from "@/lib/appAuth";
import { SmsService } from "@/lib/services/sms.service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { phone, otp, name } = await req.json();

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

    // Special case: Demo User Bypass
    if (normalizedPhone === "9999999999" && otp === "123456") {
      isVerified = true;
    }

    // 1. Try local DB check first (instantaneous, timezone desync-safe)
    if (!isVerified) {
      const verification = await prisma.verificationCode.findFirst({
        where: {
          phone: { contains: normalizedPhone },
          code: otp
        },
        orderBy: { createdAt: 'desc' }
      });

      if (verification) {
        const ageInMs = Date.now() - new Date(verification.createdAt).getTime();
        // Valid within a 15 minutes window
        if (ageInMs < 15 * 60 * 1000) {
          isVerified = true;
          // Delete the used code to prevent reuse
          await prisma.verificationCode.delete({
            where: { id: verification.id }
          }).catch(console.error);
        }
      }
    }

    // 2. Fallback to Twilio Verify check if not verified by local DB
    if (!isVerified) {
      try {
        const verifyCheck = await SmsService.checkVerification(phone, otp);
        if (verifyCheck === true) {
          isVerified = true;
        }
      } catch (err: any) {
        console.log("[Mobile Verify] Twilio Verify check failed/skipped:", err.message);
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

    // Try to find local customer by phone, email, or Shopify ID
    const searchConditions: any[] = [
      { phone: fullPhone },
      { phone: phoneDigits },
      { phone: { contains: normalizedPhone } }
    ];

    if (shopifyCustomer) {
      searchConditions.push({ shopifyId: String(shopifyCustomer.id) });
      if (shopifyCustomer.email) {
        searchConditions.push({ email: shopifyCustomer.email });
      }
      if (shopifyCustomer.phone) {
        searchConditions.push({ phone: shopifyCustomer.phone });
      }
    }

    let customer = await prisma.customer.findFirst({
      where: {
        OR: searchConditions
      },
      include: { communityMember: true }
    });

    let syncSuccess = false;

    try {
      if (shopifyCustomer) {
        // Sync local DB with Shopify data
        if (customer) {
          console.log(`[Mobile Verify] Updating local customer ${customer.id} with Shopify ID: ${shopifyCustomer.id}`);
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
              shopifyId: String(shopifyCustomer.id),
              email: shopifyCustomer.email || customer.email || undefined,
              name: name || `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || customer.name || "User",
              phone: shopifyCustomer.phone || customer.phone || fullPhone,
              ordersCount: shopifyCustomer.orders_count || customer.ordersCount,
              totalSpent: parseFloat(shopifyCustomer.total_spent || "0") || customer.totalSpent,
            },
            include: { communityMember: true }
          });
        } else {
          customer = await prisma.customer.upsert({
            where: { shopifyId: String(shopifyCustomer.id) },
            create: {
              shopifyId: String(shopifyCustomer.id),
              shopId: shop.id,
              email: shopifyCustomer.email,
              name: name || `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || "User",
              phone: shopifyCustomer.phone || fullPhone,
              ordersCount: shopifyCustomer.orders_count || 0,
              totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
            },
            update: {
              email: shopifyCustomer.email || undefined,
              name: name || `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim() || undefined,
              phone: shopifyCustomer.phone || undefined,
              ordersCount: shopifyCustomer.orders_count || 0,
              totalSpent: parseFloat(shopifyCustomer.total_spent || "0"),
            },
            include: { communityMember: true }
          });
        }
        syncSuccess = true;

        // Import customer addresses from Shopify to local DB
        if (shopifyCustomer.addresses && Array.isArray(shopifyCustomer.addresses)) {
          for (const addr of shopifyCustomer.addresses) {
            const a = addr as any;
            const existingAddr = await prisma.address.findFirst({
              where: {
                customerId: customer.id,
                address1: a.address1,
                city: a.city,
                zip: a.zip
              }
            });

            if (!existingAddr) {
              await prisma.address.create({
                data: {
                  customerId: customer.id,
                  name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || customer.name || "User",
                  phone: a.phone || customer.phone || fullPhone,
                  address1: a.address1,
                  address2: a.address2 || "",
                  city: a.city,
                  state: a.province || "",
                  zip: a.zip,
                  country: a.country || "India",
                  isDefault: a.default || false
                }
              }).catch(console.error);
            }
          }
        }
      }
    } catch (syncError: any) {
      console.error("[Mobile Verify] Shopify customer sync/upsert error, falling back to local database:", syncError.message);
    }

    if (!customer) {
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
            name: name || "New User",
          },
          include: { communityMember: true }
        });
      } else if (name) {
        // Update existing customer name if provided
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { name },
          include: { communityMember: true }
        });
      }
    } else if (!syncSuccess) {
      if (name) {
        // Update name if sync failed but user entered a new name
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { name },
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
