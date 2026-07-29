const { Pool } = require('pg');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!dbUrl) {
  console.error("❌ Error: Missing required database connection environment variable (DIRECT_URL or DATABASE_URL).");
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected to Supabase PostgreSQL!");

    // 1. Create order_sequences table
    console.log("Creating/verifying order_sequences table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_sequences (
        year_month VARCHAR(4) PRIMARY KEY,
        current_value INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 2. Modify shopifyOrderId to be nullable
    console.log("Altering 'Order' table column 'shopifyOrderId' to be nullable...");
    await client.query(`
      ALTER TABLE "Order" ALTER COLUMN "shopifyOrderId" DROP NOT NULL;
    `);

    // 3. Add universal numbering, sync, refund, and cancellation columns
    console.log("Checking and adding new columns to 'Order' table...");
    const columns = [
      { name: 'internal_order_number', type: 'VARCHAR(50)' },
      { name: 'shopify_order_name', type: 'VARCHAR(100)' },
      { name: 'shopify_sync_status', type: "VARCHAR(20) DEFAULT 'synced'" },
      { name: 'shopify_sync_error', type: 'TEXT' },
      { name: 'refund_status', type: "VARCHAR(20) DEFAULT 'not_applicable'" },
      { name: 'refund_error', type: 'TEXT' },
      { name: 'refund_attempts', type: 'INTEGER DEFAULT 0' },
      { name: 'cancelled_at', type: 'TIMESTAMP' },
      { name: 'cancelled_by', type: 'VARCHAR(100)' }
    ];

    for (const col of columns) {
      await client.query(`
        ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};
      `);
    }

    // Add unique constraint to internal_order_number if not already present
    try {
      await client.query(`
        ALTER TABLE "Order" ADD CONSTRAINT "Order_internal_order_number_key" UNIQUE ("internal_order_number");
      `);
      console.log("Added unique constraint on internal_order_number.");
    } catch (e) {
      console.log("Unique constraint on internal_order_number already exists or failed (will proceed):", e.message);
    }

    // 4. Create SyncLog table
    console.log("Creating/verifying SyncLog table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "SyncLog" (
        id TEXT PRIMARY KEY,
        "orderId" TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        payload TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    // 5. Create/Replace generate_internal_order_number trigger function
    console.log("Creating/replacing database trigger function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_internal_order_number()
      RETURNS TRIGGER AS $$
      DECLARE
          seq_val INTEGER;
          ym VARCHAR(4);
          existing_num VARCHAR(50);
      BEGIN
          -- If this is an upsert/insert where shopifyOrderId already exists, reuse the existing internal_order_number
          IF NEW."shopifyOrderId" IS NOT NULL AND NEW."shopifyOrderId" <> '' THEN
              SELECT internal_order_number INTO existing_num FROM "Order" WHERE "shopifyOrderId" = NEW."shopifyOrderId" LIMIT 1;
              IF existing_num IS NOT NULL AND existing_num <> '' THEN
                  NEW.internal_order_number := existing_num;
                  RETURN NEW;
              END IF;
          END IF;

          IF NEW.internal_order_number IS NULL OR NEW.internal_order_number = '' THEN
              ym := to_char(CURRENT_DATE, 'YYMM');
              
              INSERT INTO order_sequences (year_month, current_value)
              VALUES (ym, 1)
              ON CONFLICT (year_month)
              DO UPDATE SET current_value = order_sequences.current_value + 1
              RETURNING current_value INTO seq_val;
              
              NEW.internal_order_number := 'ZB-' || ym || '-' || lpad(seq_val::text, 5, '0');
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 6. Register BEFORE INSERT trigger
    console.log("Registering BEFORE INSERT trigger on 'Order' table...");
    await client.query("DROP TRIGGER IF EXISTS trg_generate_internal_order_number ON \"Order\"");
    await client.query(`
      CREATE TRIGGER trg_generate_internal_order_number
      BEFORE INSERT ON "Order"
      FOR EACH ROW
      EXECUTE FUNCTION generate_internal_order_number()
    `);

    console.log("Database schema adjustments, triggers and tables configured successfully!");
  } catch (err) {
    console.error("Database setup failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
