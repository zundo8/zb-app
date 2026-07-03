import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/db';

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
        quantity INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'IN_STOCK',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize price tag tables:', error);
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureTablesExist();

    const batches = await prisma.$queryRawUnsafe(
      `SELECT * FROM price_tag_batches ORDER BY created_at DESC LIMIT 50`
    );

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
      if (tagsGenerated && Array.isArray(tagsGenerated)) {
        for (const tag of tagsGenerated) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO product_skus (product_id, sku, size, quantity, status)
             VALUES ($1, $2, $3, 1, 'IN_STOCK')
             ON CONFLICT (sku) DO UPDATE SET
               product_id = EXCLUDED.product_id,
               size = EXCLUDED.size,
               quantity = 1,
               status = 'IN_STOCK'`,
            String(productId),
            String(tag.sku),
            String(tag.size)
          );
        }
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Price Tags Batches Action Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
