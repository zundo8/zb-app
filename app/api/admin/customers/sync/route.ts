import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchAllCustomers } from '@/lib/shopify-admin';
import { requirePermission, handleAuthError } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requirePermission('CUSTOMERS', 'edit');

    let shop = await prisma.shop.findFirst();
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          domain: process.env.SHOPIFY_STORE_DOMAIN || "8tiahf-bk.myshopify.com",
          accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "",
        }
      });
    }

    const shopifyCustomers = await fetchAllCustomers(250).catch((e: any) => {
      console.error("[Customers Sync Manual] fetchAllCustomers failed:", e);
      return [];
    });

    let syncedCount = 0;
    for (const sc of shopifyCustomers) {
      const shopifyId = String(sc.id);
      const email = sc.email || null;
      const phone = sc.phone || null;
      const name = `${sc.first_name || ""} ${sc.last_name || ""}`.trim() || email || phone || "Customer";

      await prisma.customer.upsert({
        where: { shopifyId },
        update: {
          email,
          phone,
          name,
          ordersCount: sc.orders_count || 0,
          totalSpent: parseFloat(sc.total_spent || "0"),
        },
        create: {
          shopifyId,
          shopId: shop.id,
          email,
          phone,
          name,
          ordersCount: sc.orders_count || 0,
          totalSpent: parseFloat(sc.total_spent || "0"),
        }
      }).catch((e: any) => {
        console.error(`[Sync upsert failed] shopifyId: ${shopifyId}`, e.message);
      });

      // Sync addresses
      if (sc.addresses && Array.isArray(sc.addresses)) {
        const dbCustomer = await prisma.customer.findUnique({ where: { shopifyId } });
        if (dbCustomer) {
          for (const addr of sc.addresses) {
            const a = addr as any;
            const exists = await prisma.address.findFirst({
              where: {
                customerId: dbCustomer.id,
                address1: a.address1,
                city: a.city,
                zip: a.zip
              }
            });
            if (!exists) {
              await prisma.address.create({
                data: {
                  customerId: dbCustomer.id,
                  name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || dbCustomer.name || "Customer",
                  phone: a.phone || dbCustomer.phone,
                  address1: a.address1,
                  address2: a.address2 || "",
                  city: a.city,
                  state: a.province || "",
                  zip: a.zip,
                  country: a.country || "India",
                  isDefault: a.default || false
                }
              }).catch(() => {});
            }
          }
        }
      }

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedCount} customers.`,
      syncedCount
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
