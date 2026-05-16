import { NextResponse } from 'next/server';
import {
  fetchAllOrders,
  fetchAllCustomers,
  fetchAllProducts,
  fetchLocations,
  fetchInventoryLevels,
} from '@/lib/shopify-admin';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shopify/sync
 * Performs a full sync: pulls all products, orders, customers from Shopify
 * and upserts them into the local SQLite database.
 */
export async function POST() {
  const results = {
    products: 0,
    orders: 0,
    customers: 0,
    inventory: 0,
    errors: [] as string[],
  };

  try {
    // Ensure shop record exists
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com';
    const envToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    let shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
    
    if (!shop) {
      console.log(`[Sync Route] Creating new shop record for ${shopDomain}`);
      shop = await prisma.shop.create({
        data: {
          domain: shopDomain,
          accessToken: envToken || 'shpat_placeholder',
        },
      });
    } else if (envToken && (!shop.accessToken || shop.accessToken.includes('placeholder') || shop.accessToken.includes('required'))) {
      // Heal the shop record if it has a placeholder but we have a real token in env
      shop = await prisma.shop.update({
        where: { id: shop.id },
        data: { accessToken: envToken }
      });
      console.log(`[Sync Route] Updated shop ${shopDomain} with real token from environment.`);
    }

    // ─── Parallel Syncing ──────────────────────────────────────────
    const syncProducts = async () => {
      try {
        const products = await fetchAllProducts(250);
        await Promise.all(products.map(async (p) => {
          const firstVariant = p.variants?.[0];
          await prisma.product.upsert({
            where: { shopifyProductId: String(p.id) },
            create: {
              shopId: shop.id,
              shopifyProductId: String(p.id),
              title: p.title,
              handle: p.handle,
              price: parseFloat(firstVariant?.price || '0'),
              sku: firstVariant?.sku || null,
              barcode: firstVariant?.barcode || null,
              inventoryItemId: firstVariant ? String(firstVariant.inventory_item_id) : null,
              featuredImage: p.image?.src || p.images?.[0]?.src || null,
            },
            update: {
              title: p.title,
              handle: p.handle,
              price: parseFloat(firstVariant?.price || '0'),
              sku: firstVariant?.sku || null,
              barcode: firstVariant?.barcode || null,
              inventoryItemId: firstVariant ? String(firstVariant.inventory_item_id) : null,
              featuredImage: p.image?.src || p.images?.[0]?.src || null,
            },
          });
          results.products++;
        }));
      } catch (e: any) {
        results.errors.push(`Products: ${e.message}`);
      }
    };

    const syncCustomers = async () => {
      try {
        const customers = await fetchAllCustomers(250);
        await Promise.all(customers.map(async (c) => {
          await prisma.customer.upsert({
            where: { shopifyId: String(c.id) },
            create: {
              shopId: shop.id,
              shopifyId: String(c.id),
              email: c.email,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              phone: c.phone,
              defaultAddress: c.default_address ? JSON.stringify(c.default_address) : null,
              ordersCount: c.orders_count || 0,
              totalSpent: c.total_spent ? parseFloat(c.total_spent) : 0,
            },
            update: {
              email: c.email,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              phone: c.phone,
              defaultAddress: c.default_address ? JSON.stringify(c.default_address) : null,
              ordersCount: c.orders_count || 0,
              totalSpent: c.total_spent ? parseFloat(c.total_spent) : 0,
            },
          });
          results.customers++;
        }));
      } catch (e: any) {
        results.errors.push(`Customers: ${e.message}`);
      }
    };

    const syncOrders = async () => {
      try {
        // Fetch products first to have a cache of images
        const productsRaw = await fetchAllProducts(250);
        const productImageMap = new Map<string, string>();
        productsRaw.forEach(p => {
          const img = p.image?.src || p.images?.[0]?.src;
          if (img) productImageMap.set(String(p.id), img);
        });

        const orders = await fetchAllOrders(250);
        for (const o of orders) {
          const customerId = o.customer ? String(o.customer.id) : 'anonymous';

          // Ensure customer exists
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
                defaultAddress: o.customer.default_address ? JSON.stringify(o.customer.default_address) : null,
                ordersCount: o.customer.orders_count || 0,
                totalSpent: o.customer.total_spent ? parseFloat(o.customer.total_spent) : 0,
              },
              update: {},
            });
          } else {
            dbCustomer = await prisma.customer.upsert({
              where: { shopifyId: 'anonymous' },
              create: { shopId: shop.id, shopifyId: 'anonymous', name: 'Anonymous' },
              update: {},
            });
          }

          // Determine delivery status from fulfillments and tags
          let deliveryStatus = 'pending';
          const lowerTags = (o.tags || '').toLowerCase();
          
          if (o.fulfillment_status === 'fulfilled') {
            deliveryStatus = 'shipped';
          }

          // Check tags for manual delivery markers
          if (lowerTags.includes('delivered') || lowerTags.includes('shipped_successfully')) {
            deliveryStatus = 'delivered';
          }
          
          if (o.fulfillments && Array.isArray(o.fulfillments)) {
            for (const f of o.fulfillments) {
              const fStatus = (f.shipment_status || '').toLowerCase();
              if (fStatus === 'delivered' || fStatus === 'shipped' || fStatus === 'success') {
                deliveryStatus = 'delivered';
                break;
              } else if (fStatus === 'out_for_delivery') {
                deliveryStatus = 'out_for_delivery';
                break;
              }
            }
          }

          const isMobileAppOrder = lowerTags.includes('apporder') || lowerTags.includes('mobileapp');
          const currentStatus = o.status || 'active';
          
          // Orders from Shopify are considered "approved" if they are mobile app orders
          let finalStatus = isMobileAppOrder ? 'approved' : 'active';
          
          if (o.cancelled_at) {
            finalStatus = 'cancelled';
          }

          const order = await prisma.order.upsert({
            where: { shopifyOrderId: String(o.id) },
            create: {
              shopId: shop.id,
              shopifyOrderId: String(o.id),
              customerId: dbCustomer.id,
              status: finalStatus,
              totalPrice: parseFloat(o.total_price || '0'),
              subtotalPrice: o.subtotal_price ? parseFloat(o.subtotal_price) : null,
              totalTax: o.total_tax ? parseFloat(o.total_tax) : null,
              currency: o.currency || 'INR',
              paymentStatus: o.financial_status || 'pending',
              fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
              deliveryStatus: deliveryStatus,
              shippingAddress: o.shipping_address ? JSON.stringify(o.shipping_address) : null,
              billingAddress: o.billing_address ? JSON.stringify(o.billing_address) : null,
              note: o.note || null,
              tags: o.tags || null,
              createdAt: new Date(o.created_at),
            },
            update: {
              status: finalStatus, // Always update status from sync if it's in Shopify
              totalPrice: parseFloat(o.total_price || '0'),
              subtotalPrice: o.subtotal_price ? parseFloat(o.subtotal_price) : null,
              totalTax: o.total_tax ? parseFloat(o.total_tax) : null,
              currency: o.currency || 'INR',
              paymentStatus: o.financial_status || 'pending',
              fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
              deliveryStatus: deliveryStatus,
              shippingAddress: o.shipping_address ? JSON.stringify(o.shipping_address) : null,
              billingAddress: o.billing_address ? JSON.stringify(o.billing_address) : null,
              note: o.note || null,
              tags: o.tags || null,
            },
          });

          // Delete old line items that do not match Shopify's IDs
          const shopifyItemIds = o.line_items.map((item: any) => String(item.id));
          await prisma.orderItem.deleteMany({
            where: {
              orderId: order.id,
              shopifyLineItemId: { notIn: shopifyItemIds }
            }
          });

          // Line items in parallel for this order
          await Promise.all(o.line_items.map(async (item: any) => {
            const shopifyProductId = item.product_id ? String(item.product_id) : null;
            let dbProductId = null;
            if (shopifyProductId) {
              const prod = await prisma.product.findUnique({ where: { shopifyProductId } });
              dbProductId = prod?.id || null;
            }

            // Resolve image for this item
            const itemImage = shopifyProductId ? productImageMap.get(shopifyProductId) : null;

            await prisma.orderItem.upsert({
              where: { shopifyLineItemId: String(item.id) },
              create: {
                orderId: order.id,
                shopifyLineItemId: String(item.id),
                productId: dbProductId,
                title: item.title,
                quantity: item.quantity,
                price: parseFloat(item.price || '0'),
                sku: item.sku || null,
                image: itemImage || null,
              },
              update: {
                quantity: item.quantity,
                price: parseFloat(item.price || '0'),
                sku: item.sku || null,
                image: itemImage || null,
              },
            });
          }));
          results.orders++;
        }
      } catch (e: any) {
        results.errors.push(`Orders: ${e.message}`);
      }
    };

    const syncInventory = async () => {
      try {
        const locations = await fetchLocations();
        if (locations.length > 0) {
          const locationIds = locations.map((l) => String(l.id));
          const levels = await fetchInventoryLevels(locationIds);

          await Promise.all(levels.map(async (level) => {
            const product = await prisma.product.findUnique({
              where: { inventoryItemId: String(level.inventory_item_id) },
            });
            if (product) {
              await prisma.inventory.upsert({
                where: {
                  productId_locationId: {
                    productId: product.id,
                    locationId: String(level.location_id),
                  },
                },
                create: {
                  productId: product.id,
                  locationId: String(level.location_id),
                  stockQuantity: level.available ?? 0,
                  reservedQuantity: 0,
                },
                update: {
                  stockQuantity: level.available ?? 0,
                },
              });
              results.inventory++;
            }
          }));
        }
      } catch (e: any) {
        results.errors.push(`Inventory: ${e.message}`);
      }
    };

    const syncLogistics = async () => {
      try {
        const activeShipments = await prisma.shipment.findMany({
          where: {
            courier: 'Delhivery',
            status: { notIn: ['delivered', 'cancelled', 'returned'] },
          },
          take: 50 // Limit batch size
        });

        if (activeShipments.length === 0) return;

        const { trackDelhiveryShipment } = await import('@/lib/delhivery');
        const waybills = activeShipments.map(s => s.awb);
        const trackingData = await trackDelhiveryShipment(waybills);

        if (trackingData && trackingData.ShipmentData) {
          await Promise.all(trackingData.ShipmentData.map(async (data: any) => {
            const waybill = data.Shipment?.AWB || data.Shipment?.Waybill;
            if (!waybill) return;

            const shipment = activeShipments.find(s => s.awb === String(waybill));
            if (!shipment) return;

            const newStatus = (data.Shipment?.Status?.Status || 'pending').toLowerCase();
            
            // Update Shipment record
            await prisma.shipment.update({
              where: { id: shipment.id },
              data: { status: newStatus }
            });

            // Update Order record delivery status
            await prisma.order.update({
              where: { id: shipment.orderId },
              data: { deliveryStatus: newStatus }
            });
          }));
        }
        results.inventory++; // Reuse inventory counter or add new one if needed
      } catch (e: any) {
        results.errors.push(`Logistics: ${e.message}`);
      }
    };

    // Run all sync tasks
    await Promise.all([
      syncProducts(),
      syncCustomers(),
      syncOrders(),
      syncInventory(),
      syncLogistics(),
    ]);

    return NextResponse.json({
      success: true,
      synced: results,
    });
  } catch (error: any) {
    console.error('Sync Error:', error.stack);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message, partialResults: results },
      { status: 500 }
    );
  }
}
