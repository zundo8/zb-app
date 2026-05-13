import prisma from '../lib/db';
import { fetchAllOrders, fetchAllCustomers, fetchAllProducts, fetchLocations, fetchInventoryLevels } from '../lib/shopify-admin';

async function sync() {
  console.log('--- STARTING MANUAL SYNC ---');
  try {
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com';
    const envToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    let shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
    if (!shop) {
      console.log('Creating shop record...');
      shop = await prisma.shop.create({
        data: {
          domain: shopDomain,
          accessToken: envToken || 'shpat_placeholder',
        }
      });
    } else if (envToken && shop.accessToken !== envToken) {
       console.log('Updating shop token...');
       shop = await prisma.shop.update({
         where: { id: shop.id },
         data: { accessToken: envToken }
       });
    }

    console.log('Syncing Customers...');
    const customers = await fetchAllCustomers(250);
    console.log(`Found ${customers.length} customers. Upserting...`);
    for (const c of customers) {
      await prisma.customer.upsert({
        where: { shopifyId: String(c.id) },
        create: {
          shopId: shop.id,
          shopifyId: String(c.id),
          email: c.email,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          phone: c.phone,
          ordersCount: c.orders_count || 0,
          totalSpent: c.total_spent ? parseFloat(c.total_spent) : 0,
        },
        update: {
          email: c.email,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          ordersCount: c.orders_count || 0,
          totalSpent: c.total_spent ? parseFloat(c.total_spent) : 0,
        }
      });
    }

    console.log('Syncing Products...');
    const products = await fetchAllProducts(250);
    console.log(`Found ${products.length} products. Upserting...`);
    for (const p of products) {
      const firstVariant = p.variants[0];
      await prisma.product.upsert({
        where: { shopifyProductId: String(p.id) },
        create: {
          shopId: shop.id,
          shopifyProductId: String(p.id),
          title: p.title,
          handle: p.handle,
          price: parseFloat(firstVariant?.price || '0'),
          sku: firstVariant?.sku || null,
          featuredImage: p.image?.src || null,
          inventoryItemId: firstVariant ? String(firstVariant.inventory_item_id) : null,
        },
        update: {
          title: p.title,
          handle: p.handle,
          price: parseFloat(firstVariant?.price || '0'),
          sku: firstVariant?.sku || null,
          featuredImage: p.image?.src || null,
        }
      });
    }

    console.log('Syncing Orders...');
    const orders = await fetchAllOrders(250);
    console.log(`Found ${orders.length} orders. Upserting...`);
    for (const o of orders) {
      const customerId = o.customer ? String(o.customer.id) : 'anonymous';
      
      // We skip detailed order item sync in this simple script for speed,
      // but we ensure the order exists for the dashboard stats.
      
      const dbCustomer = await prisma.customer.findUnique({ where: { shopifyId: customerId } });
      if (!dbCustomer) continue;

      await prisma.order.upsert({
        where: { shopifyOrderId: String(o.id) },
        create: {
          shopId: shop.id,
          shopifyOrderId: String(o.id),
          customerId: dbCustomer.id,
          status: 'active',
          totalPrice: parseFloat(o.total_price || '0'),
          paymentStatus: o.financial_status || 'pending',
          fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
          createdAt: new Date(o.created_at),
        },
        update: {
          totalPrice: parseFloat(o.total_price || '0'),
          paymentStatus: o.financial_status || 'pending',
        }
      });
    }

    console.log('Sync Complete!');
  } catch (err) {
    console.error('Sync Failed:', err);
  }
}

sync().finally(() => prisma.$disconnect());
