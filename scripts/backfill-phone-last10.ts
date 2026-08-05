import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function backfill() {
  const { default: prisma } = await import('../lib/db');
  console.log('[Backfill] Starting fast SQL phoneLast10 backfill...');

  const cCount = await prisma.$executeRawUnsafe(`
    UPDATE "Customer" 
    SET "phoneLast10" = RIGHT(REGEXP_REPLACE("phone", '\\D', '', 'g'), 10) 
    WHERE "phone" IS NOT NULL AND LENGTH(REGEXP_REPLACE("phone", '\\D', '', 'g')) >= 10 AND ("phoneLast10" IS NULL OR "phoneLast10" = '');
  `);
  console.log(`[Backfill] Updated ${cCount} Customer records.`);

  const wcCount = await prisma.$executeRawUnsafe(`
    UPDATE "web_store_customers" 
    SET "phone_last_10" = RIGHT(REGEXP_REPLACE("phone", '\\D', '', 'g'), 10) 
    WHERE "phone" IS NOT NULL AND LENGTH(REGEXP_REPLACE("phone", '\\D', '', 'g')) >= 10 AND ("phone_last_10" IS NULL OR "phone_last_10" = '');
  `);
  console.log(`[Backfill] Updated ${wcCount} WebStoreCustomer records.`);

  const woCount = await prisma.$executeRawUnsafe(`
    UPDATE "web_store_orders" 
    SET "phone_last_10" = RIGHT(REGEXP_REPLACE("customer_phone", '\\D', '', 'g'), 10) 
    WHERE "customer_phone" IS NOT NULL AND LENGTH(REGEXP_REPLACE("customer_phone", '\\D', '', 'g')) >= 10 AND ("phone_last_10" IS NULL OR "phone_last_10" = '');
  `);
  console.log(`[Backfill] Updated ${woCount} WebStoreOrder records.`);

  const aCount = await prisma.$executeRawUnsafe(`
    UPDATE "Address" 
    SET "phoneLast10" = RIGHT(REGEXP_REPLACE("phone", '\\D', '', 'g'), 10) 
    WHERE "phone" IS NOT NULL AND LENGTH(REGEXP_REPLACE("phone", '\\D', '', 'g')) >= 10 AND ("phoneLast10" IS NULL OR "phoneLast10" = '');
  `);
  console.log(`[Backfill] Updated ${aCount} Address records.`);

  const ctCount = await prisma.$executeRawUnsafe(`
    UPDATE "cart_sessions" 
    SET "phone_last_10" = RIGHT(REGEXP_REPLACE("phone_number", '\\D', '', 'g'), 10) 
    WHERE "phone_number" IS NOT NULL AND LENGTH(REGEXP_REPLACE("phone_number", '\\D', '', 'g')) >= 10 AND ("phone_last_10" IS NULL OR "phone_last_10" = '');
  `);
  console.log(`[Backfill] Updated ${ctCount} Cart records.`);

  console.log('[Backfill] phoneLast10 SQL backfill completed successfully.');
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Backfill] Error:', err);
    process.exit(1);
  });
