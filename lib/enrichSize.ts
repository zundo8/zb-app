import prisma from "@/lib/db";
import { extractItemVariantAndSize } from "@/lib/utils";

/**
 * Extracts size from an item using size property or SKU/title regex.
 */
export function extractSize(orderItem: any): string {
  if (orderItem?.size) return orderItem.size.toString().trim().toUpperCase();
  if (orderItem?.originalSize) return orderItem.originalSize.toString().trim().toUpperCase();
  if (orderItem?.newSize) return orderItem.newSize.toString().trim().toUpperCase();

  const vInfo = extractItemVariantAndSize(
    orderItem?.title || orderItem?.product?.title || orderItem?.originalProduct?.title || orderItem?.newProduct?.title,
    orderItem?.sku || orderItem?.product?.sku || orderItem?.originalProduct?.sku || orderItem?.newProduct?.sku,
    orderItem?.variantTitle || orderItem?.originalVariantTitle || orderItem?.newVariantTitle,
    orderItem?.size
  );
  return vInfo.size || "";
}

/**
 * Enriches a single order/return/exchange item with resolved `size`, `variantTitle`, and `sku`
 * using snapshot values, extractItemVariantAndSize, WebStoreOrder matching, and product_skus DB fallbacks.
 */
export async function enrichSingleItem(item: any, parentOrder?: any) {
  if (!item) return item;
  let size = extractSize(item);
  let variantTitle = item.variantTitle || item.originalVariantTitle || item.newVariantTitle || null;
  let sku = item.sku || item.product?.sku || item.originalProduct?.sku || item.newProduct?.sku || null;

  const productId = item.productId || item.product?.id || item.originalProductId || item.newProductId;
  const orderId = item.orderId || parentOrder?.id;

  // 1. Cross-reference WebStoreOrder items JSON if size is missing
  if (!size) {
    try {
      let webOrder = null;

      if (parentOrder?.razorpayOrderId) {
        webOrder = await prisma.webStoreOrder.findFirst({
          where: { razorpayOrderId: parentOrder.razorpayOrderId }
        });
      }
      if (!webOrder && (parentOrder?.internalOrderNumber || parentOrder?.shopifyOrderName)) {
        const orderNumSearch = (parentOrder.internalOrderNumber || parentOrder.shopifyOrderName || "").replace('#', '');
        if (orderNumSearch) {
          webOrder = await prisma.webStoreOrder.findFirst({
            where: { orderNumber: { contains: orderNumSearch, mode: 'insensitive' } }
          });
        }
      }
      if (!webOrder && orderId) {
        webOrder = await prisma.webStoreOrder.findFirst({
          where: {
            OR: [
              { notes: { contains: `Local: ${orderId}` } },
              { id: orderId }
            ]
          }
        });
      }

      if (webOrder && Array.isArray(webOrder.items)) {
        const itemTitleUpper = (item.title || item.product?.title || '').trim().toUpperCase();
        const matchedWebItem: any = (webOrder.items as any[]).find((wItem: any) => {
          const wTitleUpper = (wItem.title || '').trim().toUpperCase();
          return wTitleUpper === itemTitleUpper ||
            (wItem.product_id && (wItem.product_id === productId || wItem.product_id === item.shopifyProductId)) ||
            (wItem.price && Number(wItem.price) === Number(item.price));
        });

        if (matchedWebItem && matchedWebItem.size) {
          size = matchedWebItem.size.toString().trim().toUpperCase();
          if (!variantTitle) {
            variantTitle = `Size: ${size}`;
          }
        }
      }
    } catch (_) {}
  }

  // 2. Cross-reference product_skus DB table by SKU
  if (!size && sku) {
    try {
      const skuRecs: any[] = await prisma.$queryRawUnsafe(
        `SELECT size FROM product_skus WHERE UPPER(sku) = $1 AND size IS NOT NULL AND size != '' LIMIT 1`,
        sku.trim().toUpperCase()
      );
      if (skuRecs.length > 0 && skuRecs[0].size) {
        size = skuRecs[0].size.trim().toUpperCase();
      }
    } catch (_) {}
  }

  // 3. Cross-reference product_skus DB table by Product ID
  if (!size && productId) {
    try {
      const prodSkuRecs: any[] = await prisma.$queryRawUnsafe(
        `SELECT size FROM product_skus WHERE product_id = $1 AND size IS NOT NULL AND size != '' LIMIT 1`,
        productId
      );
      if (prodSkuRecs.length > 0 && prodSkuRecs[0].size) {
        size = prodSkuRecs[0].size.trim().toUpperCase();
      }
    } catch (_) {}
  }

  // 4. Resolve SKU if missing
  if (!sku && productId) {
    try {
      const skuQuery: any[] = size
        ? await prisma.$queryRawUnsafe(
            `SELECT sku FROM product_skus WHERE product_id = $1 AND UPPER(size) = $2 LIMIT 1`,
            productId,
            size.trim().toUpperCase()
          )
        : await prisma.$queryRawUnsafe(
            `SELECT sku FROM product_skus WHERE product_id = $1 LIMIT 1`,
            productId
          );
      if (skuQuery.length > 0 && skuQuery[0].sku) {
        sku = skuQuery[0].sku;
      }
    } catch (_) {}
  }

  const resolvedSize = size || null;
  const resolvedVariantTitle = variantTitle || (resolvedSize ? `Size: ${resolvedSize}` : null);

  // Backfill resolved size into OrderItem DB table if missing
  if (resolvedSize && item.id && !item.size) {
    try {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          size: resolvedSize,
          variantTitle: resolvedVariantTitle,
        }
      });
    } catch (_) {}
  }

  return {
    ...item,
    sku: sku || null,
    size: resolvedSize,
    variantTitle: resolvedVariantTitle,
  };
}

/**
 * Enriches an array of line items with resolved size, variantTitle, and SKU.
 */
export async function enrichItemsWithSize(rawItems: any[], parentOrder?: any) {
  if (!rawItems || !Array.isArray(rawItems)) return [];
  return Promise.all(rawItems.map((item) => enrichSingleItem(item, parentOrder)));
}

/**
 * Enriches an exchange line item (both original and replacement products).
 */
export async function enrichExchangeItem(ex: any) {
  if (!ex) return ex;

  let origSize = ex.originalSize;
  let origVariant = ex.originalVariantTitle;
  let origSku = ex.originalSku || ex.originalProduct?.sku;

  const enrichedOrig = await enrichSingleItem({
    title: ex.originalProduct?.title,
    sku: origSku,
    productId: ex.originalProductId,
    size: origSize,
    variantTitle: origVariant,
    orderId: ex.orderId,
  }, ex.order);

  origSize = origSize || enrichedOrig.size;
  origVariant = origVariant || enrichedOrig.variantTitle;
  origSku = origSku || enrichedOrig.sku;

  let newSize = ex.newSize;
  let newVariant = ex.newVariantTitle;
  let newSku = ex.newSku || ex.newProduct?.sku;

  const enrichedNew = await enrichSingleItem({
    title: ex.newProduct?.title,
    sku: newSku,
    productId: ex.newProductId,
    size: newSize,
    variantTitle: newVariant,
    orderId: ex.orderId,
  }, ex.order);

  newSize = newSize || enrichedNew.size;
  newVariant = newVariant || enrichedNew.variantTitle;
  newSku = newSku || enrichedNew.sku;

  return {
    ...ex,
    originalSku: origSku || null,
    originalSize: origSize || null,
    originalVariant: origVariant || (origSize ? `Size: ${origSize}` : null),
    originalVariantTitle: origVariant || null,
    newSku: newSku || null,
    newSize: newSize || null,
    newVariant: newVariant || (newSize ? `Size: ${newSize}` : null),
    newVariantTitle: newVariant || null,
  };
}
