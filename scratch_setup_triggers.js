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
  try {
    const client = await pool.connect();
    console.log("Connected successfully!");

    console.log("Updating sequence web_store_order_number_seq...");
    // Create sequence starting at 40001 if not exists, otherwise restart it at 40001
    await client.query("CREATE SEQUENCE IF NOT EXISTS web_store_order_number_seq START WITH 40001");
    try {
      await client.query("ALTER SEQUENCE web_store_order_number_seq RESTART WITH 40001");
      console.log("Sequence restarted/configured to start with 40001!");
    } catch (seqErr) {
      console.log("Alter sequence failed (might be already setup or permission issues), continuing:", seqErr.message);
    }

    console.log("Creating/replacing trigger function generate_web_order_number...");
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_web_order_number()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number LIKE 'ZB-WEB-%' THEN
              NEW.order_number := '#ZB' || nextval('web_store_order_number_seq')::text;
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log("Trigger function created!");

    console.log("Registering trigger trg_generate_web_order_number on web_store_orders...");
    // Drop trigger if exists first to avoid duplicate registration errors
    await client.query("DROP TRIGGER IF EXISTS trg_generate_web_order_number ON web_store_orders");
    await client.query(`
      CREATE TRIGGER trg_generate_web_order_number
      BEFORE INSERT ON web_store_orders
      FOR EACH ROW
      EXECUTE FUNCTION generate_web_order_number()
    `);
    console.log("Trigger registered successfully!");

    // Let's do a test insert check
    console.log("Checking if the trigger works by running a dry-run insert...");
    await client.query("BEGIN");
    const testInsert = await client.query(`
      INSERT INTO web_store_orders (
        customer_name, customer_email, customer_phone, shipping_address, items, 
        subtotal, shipping_charge, total_amount, payment_status, payment_method, order_number
      ) VALUES (
        'Test Customer', 'test@example.com', '1234567890', '{}', '[]', 
        0.0, 0.0, 0.0, 'pending', 'cod', ''
      ) RETURNING id, order_number
    `);
    console.log("Inserted test order successfully! Generated order_number:", testInsert.rows[0].order_number);
    await client.query("ROLLBACK");
    console.log("Rollback successful. Database is clean!");

    client.release();
  } catch (error) {
    console.error("Error setting up triggers:", error);
  } finally {
    await pool.end();
  }
}

main();
