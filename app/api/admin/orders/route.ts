import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fetchAllOrders } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const fulfillmentStatus = searchParams.get('fulfillmentStatus');
    const platform = searchParams.get('platform');
    const search = searchParams.get('search');
    const sync = searchParams.get('sync') === 'true';

    // To make it "live", we sync the most recent orders from Shopify on the first page load
    // or if explicitly requested.
    if (offset === 0 || sync) {
      try {
        let shop = await prisma.shop.findFirst();
        
        // Ensure shop record exists for sync to work
        if (!shop) {
          const domain = process.env.SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com';
          const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
          if (token) {
            console.log('[Admin Orders] Creating missing shop record for sync:', domain);
            shop = await prisma.shop.create({
              data: { domain, accessToken: token }
            });
          } else {
             console.warn('[Admin Orders] CANNOT SYNC: No Shop record and NO Shopify token in env.');
          }
        }

        if (shop && shop.accessToken && !shop.accessToken.includes('placeholder')) {
          console.log('[Admin Orders] Triggering live sync from Shopify (Top 50)...');
          const shopifyOrders = await fetchAllOrders(50);
          console.log(`[Admin Orders] Sync success. Found ${shopifyOrders.length} orders.`);
          
          if (shopifyOrders.length > 0) {
            for (const o of shopifyOrders) {
               const customerId = o.customer ? String(o.customer.id) : 'anonymous';
               let dbCustomer;
               if (o.customer) {
                 dbCustomer = await prisma.customer.upsert({
                   where: { shopifyId: customerId },
                   create: {
                     shopId: shop.id,
                     shopifyId: customerId,
                     email: o.customer.email,
                     name: `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim(),
                     phone: o.customer.phone,
                   },
                   update: {
                     email: o.customer.email,
                     name: `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim(),
                     phone: o.customer.phone,
                   },
                 });
               } else {
                 dbCustomer = await prisma.customer.upsert({
                   where: { shopifyId: 'anonymous' },
                   create: { shopId: shop.id, shopifyId: 'anonymous', name: 'Anonymous' },
                   update: {},
                 });
               }

               const lowerTags = (o.tags || '').toLowerCase();
               const isMobileAppOrder = lowerTags.includes('apporder') || lowerTags.includes('mobileapp') || lowerTags.includes('mobile-app');
               
               await prisma.order.upsert({
                 where: { shopifyOrderId: String(o.id) },
                 create: {
                   shopId: shop.id,
                   shopifyOrderId: String(o.id),
                   customerId: dbCustomer.id,
                   status: isMobileAppOrder ? 'approved' : 'active',
                   totalPrice: parseFloat(o.total_price || '0'),
                   paymentStatus: o.financial_status || 'pending',
                   fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
                   shippingAddress: o.shipping_address ? JSON.stringify(o.shipping_address) : null,
                   createdAt: new Date(o.created_at),
                   tags: o.tags || "",
                 },
                 update: {
                   paymentStatus: o.financial_status || 'pending',
                   fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
                   totalPrice: parseFloat(o.total_price || '0'),
                   tags: o.tags || "",
                 }
               });
            }
          }
        } else {
           console.warn('[Admin Orders] Skipping sync: Shop token is invalid or missing.');
        }
      } catch (syncErr: any) {
        console.error('[Admin Orders] Live sync exception:', syncErr.message);
      }
    }

    const conditions: any[] = [];
    
    // SIMPLIFIED FILTERING LOGIC
    if (platform === 'web') {
      conditions.push({
        AND: [
          { NOT: { tags: { contains: 'mobile-app', mode: 'insensitive' } } },
          { NOT: { tags: { contains: 'AppOrder', mode: 'insensitive' } } },
          { NOT: { orderType: 'MOBILE_APP' } }
        ]
      });
    } else if (platform === 'mobile') {
      conditions.push({
        AND: [
          {
            OR: [
              { tags: { contains: 'mobile-app', mode: 'insensitive' } },
              { tags: { contains: 'AppOrder', mode: 'insensitive' } },
              { orderType: 'MOBILE_APP' }
            ]
          },
          { status: 'approved' }
        ]
      });
    } else {
      // Platform ANY: Just exclude mobile orders that are NOT approved
      conditions.push({
        NOT: {
          AND: [
            {
              OR: [
                { tags: { contains: 'mobile-app', mode: 'insensitive' } },
                { tags: { contains: 'AppOrder', mode: 'insensitive' } },
                { orderType: 'MOBILE_APP' }
              ]
            },
            { status: { not: 'approved' } }
          ]
        }
      });
    }

    if (status && status !== 'any') {
      conditions.push({ status });
    }

    if (paymentStatus && paymentStatus !== 'any') {
      if (paymentStatus === 'failed') {
        conditions.push({ 
          OR: [
            { paymentStatus: 'failed' },
            { paymentStatus: 'voided' },
            { status: 'payment_failed' }
          ]
        });
      } else {
        conditions.push({ paymentStatus });
      }
    }

    if (fulfillmentStatus && fulfillmentStatus !== 'any') {
      conditions.push({ fulfillmentStatus });
    }

    if (search) {
      conditions.push({
        OR: [
          { shopifyOrderId: { contains: search, mode: 'insensitive' } },
          { note: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};
    console.log('[Admin Orders] Final WHERE clause:', JSON.stringify(where));

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        items: true,
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.order.count({ where });

    return NextResponse.json({
      success: true,
      orders,
      total,
      hasMore: total > offset + limit
    });
  } catch (error: any) {
    console.error('[Admin Orders API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
