import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';
import { fetchProductById } from '@/lib/shopify-admin';

export const dynamic = 'force-dynamic';

let isInitialized = false;

async function ensureTablesExist() {
  if (isInitialized) return;
  try {
    // 1. Create price_tag_batches table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS price_tag_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_number INTEGER NOT NULL DEFAULT 1,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        generic_name TEXT NOT NULL,
        mrp NUMERIC(10,2) NOT NULL,
        size TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        sku_prefix TEXT NOT NULL,
        tags_generated JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Create price_tag_sku_counters table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS price_tag_sku_counters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku_variant_key TEXT UNIQUE NOT NULL,
        last_counter INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Create atomic counter increment RPC function
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION increment_sku_counter(
        p_variant_key TEXT,
        p_quantity INTEGER
      ) RETURNS INTEGER AS $$
      DECLARE
        v_new_counter INTEGER;
      BEGIN
        INSERT INTO price_tag_sku_counters (sku_variant_key, last_counter)
        VALUES (p_variant_key, p_quantity)
        ON CONFLICT (sku_variant_key)
        DO UPDATE SET
          last_counter = price_tag_sku_counters.last_counter + p_quantity,
          updated_at = NOW()
        RETURNING last_counter INTO v_new_counter;
        RETURN v_new_counter;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 4. Create product_skus table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS product_skus (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id TEXT NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        size TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PRINTED',
        shopify_variant_id TEXT,
        inventory_item_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add columns if table already exists (idempotent)
    await prisma.$executeRawUnsafe(`ALTER TABLE product_skus ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE product_skus ADD COLUMN IF NOT EXISTS inventory_item_id TEXT`);

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize price tag tables:', error);
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureTablesExist();

    // Parse filter query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const sizeFilter = searchParams.get('size')?.trim() || '';
    const dateFrom = searchParams.get('dateFrom')?.trim() || '';
    const dateTo = searchParams.get('dateTo')?.trim() || '';
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    // Build dynamic WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(product_name ILIKE $${paramIndex} OR sku_prefix ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (sizeFilter) {
      conditions.push(`UPPER(size) = UPPER($${paramIndex})`);
      params.push(sizeFilter);
      paramIndex++;
    }
    if (dateFrom) {
      conditions.push(`created_at >= $${paramIndex}::timestamptz`);
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      // Add 1 day to make it inclusive of the end date
      conditions.push(`created_at < ($${paramIndex}::date + interval '1 day')`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM price_tag_batches ${whereClause} ORDER BY created_at DESC LIMIT ${limit}`;

    const batches = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json({ batches }, { status: 200 });
  } catch (error: any) {
    console.error('API Price Tags Batches Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureTablesExist();

    const body = await request.json();
    const { action } = body;

    if (action === 'increment-counter') {
      const { skuPrefix, quantity } = body;
      if (!skuPrefix || !quantity) {
        return NextResponse.json({ error: 'Missing parameter: skuPrefix or quantity' }, { status: 400 });
      }

      // 1. Find the highest existing counter suffix for this prefix in product_skus
      let maxExistingCounter = 0;
      try {
        const existingSkus: any[] = await prisma.$queryRawUnsafe(
          `SELECT sku FROM product_skus WHERE sku LIKE $1`,
          `${skuPrefix}%`
        );
        for (const row of existingSkus) {
          const suffix = row.sku.substring(skuPrefix.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxExistingCounter) {
            maxExistingCounter = num;
          }
        }
      } catch (e) {
        console.error('Error finding max existing SKU counter:', e);
      }

      // 2. Fetch the current counter from price_tag_sku_counters
      const result: any = await prisma.$queryRawUnsafe(
        `SELECT increment_sku_counter($1, $2) as counter`,
        skuPrefix,
        Number(quantity)
      );
      const dbCounter = Number(result[0]?.counter ?? 0);
      
      // 3. Self-healing logic: If the database counter is lower than the actual highest existing SKU counter,
      // update the counter in the DB to the correct value and return the corrected endCounter!
      let endCounter = dbCounter;
      const expectedStartCounter = dbCounter - Number(quantity) + 1;
      
      if (expectedStartCounter <= maxExistingCounter) {
        endCounter = maxExistingCounter + Number(quantity);
        
        // Correct the DB table counter to this new maximum value
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO price_tag_sku_counters (sku_variant_key, last_counter)
             VALUES ($1, $2)
             ON CONFLICT (sku_variant_key)
             DO UPDATE SET last_counter = $2, updated_at = NOW()`,
            skuPrefix,
            endCounter
          );
        } catch (dbUpdateErr) {
          console.error('Error correcting last_counter in DB:', dbUpdateErr);
        }
      }

      return NextResponse.json({ endCounter }, { status: 200 });
    }

    if (action === 'save-batch') {
      const {
        batchNumber,
        productId,
        productName,
        genericName,
        mrp,
        size,
        quantity,
        skuPrefix,
        tagsGenerated,
      } = body;

      await prisma.$executeRawUnsafe(
        `INSERT INTO price_tag_batches (batch_number, product_id, product_name, generic_name, mrp, size, quantity, sku_prefix, tags_generated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CAST($9 AS jsonb))`,
        Number(batchNumber),
        String(productId),
        String(productName),
        String(genericName),
        Number(mrp),
        String(size),
        Number(quantity),
        String(skuPrefix),
        JSON.stringify(tagsGenerated)
      );

      // Save individual SKUs to product_skus table
      // Status = PRINTED (not sellable until scanned in via Scanner STOCK_IN)
      // quantity = 0 — NO inventory is added at this point
      if (tagsGenerated && Array.isArray(tagsGenerated)) {
        // Resolve Shopify variant IDs for this product+size
        let variantMap: Record<string, { variantId: string; inventoryItemId: string }> = {};
        try {
          const localProduct = await prisma.product.findUnique({ where: { id: String(productId) } });
          if (localProduct) {
            const shopifyProduct = await fetchProductById(localProduct.shopifyProductId);
            if (shopifyProduct?.variants) {
              for (const v of shopifyProduct.variants) {
                const key = (v.option1 || v.title || '').toUpperCase();
                variantMap[key] = {
                  variantId: String(v.id),
                  inventoryItemId: String(v.inventory_item_id)
                };
              }
            }
          }
        } catch (variantErr) {
          console.error('[Price Tag Batch] Failed to resolve Shopify variants for variant linking:', variantErr);
        }

        for (const tag of tagsGenerated) {
          const sizeKey = String(tag.size).toUpperCase();
          const variant = variantMap[sizeKey] || null;
          await prisma.$executeRawUnsafe(
            `INSERT INTO product_skus (product_id, sku, size, quantity, status, shopify_variant_id, inventory_item_id)
             VALUES ($1, $2, $3, 0, 'PRINTED', $4, $5)
             ON CONFLICT (sku) DO UPDATE SET
               product_id = EXCLUDED.product_id,
               size = EXCLUDED.size,
               shopify_variant_id = COALESCE(EXCLUDED.shopify_variant_id, product_skus.shopify_variant_id),
               inventory_item_id = COALESCE(EXCLUDED.inventory_item_id, product_skus.inventory_item_id)`,
            String(productId),
            String(tag.sku),
            String(tag.size),
            variant?.variantId || null,
            variant?.inventoryItemId || null
          );
        }
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── Delete Batch — SUPER_ADMIN only ──
    if (action === 'delete-batch') {
      const userRole = (session.user as any).role;
      if (userRole !== 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admins can delete price tag batches.' },
          { status: 403 }
        );
      }

      const { batchId } = body;
      if (!batchId) {
        return NextResponse.json({ error: 'Missing parameter: batchId' }, { status: 400 });
      }

      // 1. Fetch the batch to get the tags so we can delete associated SKUs
      const batchRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM price_tag_batches WHERE id = $1::uuid`,
        String(batchId)
      );

      if (batchRows.length === 0) {
        return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
      }

      const batch = batchRows[0];
      const tags = batch.tags_generated || [];

      // 2. Delete all associated SKU records from product_skus
      if (Array.isArray(tags) && tags.length > 0) {
        const skus = tags.map((t: any) => String(t.sku));
        // Delete in chunks to avoid overly long SQL
        for (let i = 0; i < skus.length; i += 50) {
          const chunk = skus.slice(i, i + 50);
          const placeholders = chunk.map((_: string, idx: number) => `$${idx + 1}`).join(', ');
          await prisma.$executeRawUnsafe(
            `DELETE FROM product_skus WHERE sku IN (${placeholders})`,
            ...chunk
          );
        }
      }

      // 3. Delete the batch record itself
      await prisma.$executeRawUnsafe(
        `DELETE FROM price_tag_batches WHERE id = $1::uuid`,
        String(batchId)
      );

      return NextResponse.json({ success: true, message: `Batch deleted. ${tags.length} SKU records removed.` }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Price Tags Batches Action Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
