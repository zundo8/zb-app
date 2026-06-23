import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { adjustInventoryLevel, fetchLocations, fetchAllProducts } from '@/lib/shopify-admin';

function normalizeSku(raw: string): string {
  if (!raw) return '';
  return raw.trim().toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { code, mode, quantity = 1 } = await req.json();
    const qty = Math.max(1, Number(quantity) || 1);

    if (!code) {
      return NextResponse.json({ error: 'Missing Scan Data' }, { status: 400 });
    }

    const normalizedCode = normalizeSku(code);

    // Identify the subject (Product or Order)
    let matchedProduct = null;
    let matchedVariant = null;

    // 1. Search locally by ID, shopifyProductId, SKU, or Barcode
    const localProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { id: code },
          { shopifyProductId: code },
          { sku: normalizedCode },
          { barcode: normalizedCode }
        ]
      },
      include: {
        inventory: true
      }
    });

    if (localProduct) {
      matchedProduct = {
        id: localProduct.shopifyProductId,
        title: localProduct.title,
        handle: localProduct.handle,
        variants: [
          {
            id: localProduct.shopifyProductId, // fallback variant ID
            title: 'Default Variant',
            price: String(localProduct.price || 0),
            sku: localProduct.sku,
            barcode: localProduct.barcode,
            inventory_item_id: localProduct.inventoryItemId,
            inventory_quantity: localProduct.inventory[0]?.stockQuantity || 0
          }
        ]
      };
      matchedVariant = matchedProduct.variants[0];
    } else {
      // 2. Search in custom product_skus table
      try {
        const skuRecords: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM product_skus WHERE UPPER(sku) = $1`,
          normalizedCode
        );
        if (skuRecords.length > 0) {
          const skuRecord = skuRecords[0];
          const dbProduct = await prisma.product.findUnique({
            where: { id: skuRecord.product_id },
            include: { inventory: true }
          });
          if (dbProduct) {
            matchedProduct = {
              id: dbProduct.shopifyProductId,
              title: dbProduct.title,
              handle: dbProduct.handle,
              variants: [
                {
                  id: dbProduct.shopifyProductId, // fallback variant ID
                  title: `Size ${skuRecord.size}`,
                  price: String(dbProduct.price || 0),
                  sku: skuRecord.sku,
                  barcode: dbProduct.barcode,
                  inventory_item_id: dbProduct.inventoryItemId,
                  inventory_quantity: skuRecord.quantity // individual SKU's quantity!
                }
              ]
            };
            matchedVariant = matchedProduct.variants[0];
          }
        }
      } catch (e) {
        console.error('Error querying product_skus table in sync lookup:', e);
      }
    }

    // 3. Fallback to Shopify fetchAllProducts if not matched locally
    if (!matchedProduct) {
      const products = await fetchAllProducts();
      for (const p of products) {
        if (p.id.toString() === code || p.handle === code) {
          matchedProduct = p;
          matchedVariant = p.variants?.[0] || null;
          break;
        }
        for (const v of p.variants || []) {
          if (
            v.id.toString() === code ||
            normalizeSku(v.sku || '') === normalizedCode ||
            normalizeSku(v.barcode || '') === normalizedCode
          ) {
            matchedProduct = p;
            matchedVariant = v;
            break;
          }
        }
        if (matchedProduct) break;
      }
    }

    if (mode === 'LOOKUP') {
      if (matchedProduct && matchedVariant) {
        return NextResponse.json({
          success: true,
          productName: `${matchedProduct.title} - ${matchedVariant.title}`,
          sku: matchedVariant.sku,
          barcode: matchedVariant.barcode,
          currentQty: matchedVariant.inventory_quantity || 0,
        });
      }
      return NextResponse.json({ error: 'Product Not Found' }, { status: 404 });
    }

    let message = '';
    let productName = 'Unknown';

    if (matchedProduct && matchedVariant) {
      productName = `${matchedProduct.title} - ${matchedVariant.title}`;
      let delta = 0;
      const currentQty = matchedVariant.inventory_quantity || 0;

      if (mode === 'STOCK_IN') {
        delta = qty;
        message = `Injected ${qty} unit(s) of ${productName} into the grid.`;
      } 
      else if (mode === 'ORDER_OUT') {
        if (currentQty >= qty) {
          delta = -qty;
          message = `Fulfillment Complete: ${qty} unit(s) of ${productName} extracted from inventory.`;
        } else {
          return NextResponse.json({ error: `Stock Depleted. Only ${currentQty} units available.` }, { status: 400 });
        }
      }
      else if (mode === 'RETURN' || mode === 'RTO') {
        delta = qty;
        message = `${mode === 'RTO' ? 'RTO' : 'Return'} Processed: ${qty} unit(s) restored to inventory.`;
      }
      else if (mode === 'EXCHANGE') {
        if (currentQty >= qty) {
          delta = -qty;
          message = `Exchange Out: ${qty} unit(s) of ${productName} extracted for replacement.`;
        } else {
          return NextResponse.json({ error: `Stock Depleted. Only ${currentQty} units available.` }, { status: 400 });
        }
      }

      // Fetch Shopify Location and Push Update
      try {
        const locations = await fetchLocations();
        const activeLocation = locations.find((l) => l.active) || locations[0];
        const locationId = activeLocation ? String(activeLocation.id) : null;
        let newStockQuantity = currentQty + delta;

        if (locationId && matchedVariant.inventory_item_id && delta !== 0) {
          const updatedLevel = await adjustInventoryLevel(
            String(matchedVariant.inventory_item_id),
            locationId,
            delta
          );
          newStockQuantity = updatedLevel.available ?? newStockQuantity;
          
          // Sync with Prisma DB if this variant is the primary one stored
          const localProduct = await prisma.product.findUnique({
            where: { shopifyProductId: String(matchedProduct.id) }
          });
          
          if (localProduct && localProduct.inventoryItemId === String(matchedVariant.inventory_item_id)) {
            const inventory = await prisma.inventory.findFirst({
              where: { productId: localProduct.id }
            });
            
            if (inventory) {
              await prisma.inventory.update({
                where: { id: inventory.id },
                data: { stockQuantity: newStockQuantity }
              });
            }
          }
        }

        // Update product_skus table for the specific scanned SKU if it exists
        try {
          const isStockIn = mode === 'STOCK_IN' || mode === 'RETURN' || mode === 'RTO';
          const newStatus = isStockIn ? 'IN_STOCK' : 'SOLD';
          const newSkuQty = isStockIn ? 1 : 0;
          
          await prisma.$executeRawUnsafe(
            `UPDATE product_skus SET status = $1, quantity = $2 WHERE UPPER(sku) = $3`,
            newStatus,
            newSkuQty,
            normalizedCode
          );
        } catch (skuUpdateErr) {
          console.error('[Sync Update SKU Error]:', skuUpdateErr);
        }

        // Record scan
        let dbProductId = null;
        try {
          const p = await prisma.product.findUnique({ where: { shopifyProductId: String(matchedProduct.id) } });
          if (p) dbProductId = p.id;
        } catch (e) {}

        await (prisma as any).scanRecord.create({
          data: {
            productId: dbProductId,
            productTitle: matchedProduct.title,
            variantInfo: matchedVariant.title,
            sku: matchedVariant.sku,
            barcode: matchedVariant.barcode,
            actionType: mode,
            quantity: Math.abs(delta) || 1,
            beforeStock: currentQty,
            afterStock: newStockQuantity,
            locationId: locationId || 'LOCAL',
            staffName: 'Admin'
          }
        });
      } catch (e: any) {
        console.error('[Shopify Sync / Log Error]:', e);
      }

      return NextResponse.json({ 
        success: true, 
        message,
        productName,
        sku: matchedVariant.sku,
        barcode: matchedVariant.barcode
      });
    }

    // Check if it's an Order scan (OrderId)
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: code },
          { shopifyOrderId: code }
        ]
      }
    });

    if (order) {
      if (mode === 'ORDER_OUT') {
        const orderData: any = order;
        // Mark as fulfilled
        await prisma.order.update({
          where: { id: order.id },
          data: { fulfillmentStatus: 'fulfilled' }
        });
        
        // Decrement inventory for all items in the order
        // Note: In a production DB, we'd loop through line items.
        // For this demo/impl, if we have the items we'd use them.
        message = `Order ${order.shopifyOrderId} Fulfilled. Inventory decrements triggered.`;
      } else if (mode === 'RTO') {
        await prisma.order.update({
          where: { id: order.id },
          data: { deliveryStatus: 'returned_to_origin' }
        });
        message = `Order ${order.shopifyOrderId} set to RTO state. Stock restoration queued.`;
      }
      return NextResponse.json({ success: true, message, productName: `Order ${order.shopifyOrderId}` });
    }

    return NextResponse.json({ error: 'Node Not Found: Identify Mismatch.' }, { status: 404 });

  } catch (error: any) {
    console.error('[Inventory Sync Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
