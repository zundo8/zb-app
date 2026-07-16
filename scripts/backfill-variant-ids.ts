/**
 * Backfill Script: Populate shopify_variant_id and inventory_item_id
 * on existing product_skus rows.
 *
 * Usage: npx tsx scripts/backfill-variant-ids.ts
 *
 * Safe to run multiple times (idempotent).
 */

import fs from 'fs';
import path from 'path';

// Load .env.local manually to populate process.env before initializing Prisma
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const firstEq = trimmed.indexOf('=');
      if (firstEq === -1) continue;
      const key = trimmed.slice(0, firstEq).trim();
      let val = trimmed.slice(firstEq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
    console.log('[Backfill] Manually loaded .env.local variables.');
  }
} catch (e) {
  console.warn('[Backfill] Could not load .env.local:', e);
}

interface ProductSkuRow {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  shopify_variant_id: string | null;
  inventory_item_id: string | null;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('[Backfill] Starting variant ID backfill for product_skus...\n');

  // Load Prisma and shopify-admin dynamically after process.env is set
  const { default: prisma } = await import('../lib/db');
  const { fetchProductById } = await import('../lib/shopify-admin');

  // 1. Ensure columns exist
  await prisma.$executeRawUnsafe(`ALTER TABLE product_skus ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE product_skus ADD COLUMN IF NOT EXISTS inventory_item_id TEXT`);
  console.log('[Backfill] Columns ensured.\n');

  // 2. Fetch rows that need backfilling
  const rows: ProductSkuRow[] = await prisma.$queryRawUnsafe(
    `SELECT id, product_id, sku, size, shopify_variant_id, inventory_item_id
     FROM product_skus
     WHERE inventory_item_id IS NULL
     ORDER BY product_id, size`
  );

  console.log(`[Backfill] Found ${rows.length} rows needing variant ID backfill.\n`);

  if (rows.length === 0) {
    console.log('[Backfill] Nothing to backfill. Done.');
    await prisma.$disconnect();
    return;
  }

  // 3. Group by product_id to minimize Shopify API calls
  const grouped: Record<string, ProductSkuRow[]> = {};
  for (const row of rows) {
    if (!grouped[row.product_id]) grouped[row.product_id] = [];
    grouped[row.product_id].push(row);
  }

  const productIds = Object.keys(grouped);
  console.log(`[Backfill] ${productIds.length} unique products to process.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i];
    const skuRows = grouped[productId];

    // Fetch local product to get shopifyProductId
    const localProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!localProduct) {
      console.warn(`[Backfill] Product ${productId} not found in local DB. Skipping ${skuRows.length} SKU(s).`);
      skippedCount += skuRows.length;
      continue;
    }

    // Fetch Shopify product for variants
    let shopifyProduct: any;
    try {
      shopifyProduct = await fetchProductById(localProduct.shopifyProductId);
    } catch (err: any) {
      // Rate limit handling
      if (err.message?.includes('429')) {
        console.warn(`[Backfill] Rate limited. Waiting 4s before retry...`);
        await sleep(4000);
        try {
          shopifyProduct = await fetchProductById(localProduct.shopifyProductId);
        } catch (retryErr) {
          console.error(`[Backfill] Retry failed for product ${localProduct.shopifyProductId}:`, retryErr);
          errorCount += skuRows.length;
          continue;
        }
      } else {
        console.error(`[Backfill] Failed to fetch Shopify product ${localProduct.shopifyProductId}:`, err.message);
        errorCount += skuRows.length;
        continue;
      }
    }

    if (!shopifyProduct?.variants?.length) {
      console.warn(`[Backfill] No variants found for Shopify product ${localProduct.shopifyProductId}. Skipping.`);
      skippedCount += skuRows.length;
      continue;
    }

    // Build size → variant map
    const variantMap: Record<string, { variantId: string; inventoryItemId: string }> = {};
    for (const v of shopifyProduct.variants) {
      const key = (v.option1 || v.title || '').toUpperCase().trim();
      variantMap[key] = {
        variantId: String(v.id),
        inventoryItemId: String(v.inventory_item_id)
      };
    }

    // Match each SKU row
    for (const row of skuRows) {
      const sizeKey = row.size.toUpperCase().trim();
      const variant = variantMap[sizeKey];

      if (!variant) {
        console.warn(`  [Backfill] No variant match for size "${row.size}" on product "${localProduct.title}" (SKU: ${row.sku})`);
        skippedCount++;
        continue;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE product_skus SET shopify_variant_id = $1, inventory_item_id = $2 WHERE id = $3`,
        variant.variantId,
        variant.inventoryItemId,
        row.id
      );

      console.log(`  [Backfill] ✓ ${row.sku} (${row.size}) → variant=${variant.variantId}, inv_item=${variant.inventoryItemId}`);
      updatedCount++;
    }

    // Rate-limit courtesy delay between products (250ms)
    if (i < productIds.length - 1) {
      await sleep(250);
    }
  }

  console.log(`\n[Backfill] Complete!`);
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors:  ${errorCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
