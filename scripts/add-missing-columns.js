/**
 * Add missing columns to the production database to match the Prisma schema.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const queries = [
    // Shipment missing columns
    `ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT`,
    `ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "currentLocation" TEXT`,
    `ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "estimatedDelivery" TIMESTAMP(3)`,
    `ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "events" TEXT DEFAULT '[]'`,
    
    // Return missing columns
    `ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "returnMethod" TEXT`,
    `ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "refundMethod" TEXT`,
    `ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT`,
    `ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "refundAmount" DOUBLE PRECISION`,
    `ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "storeCreditAmount" DOUBLE PRECISION`,
    `ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "refundStatus" TEXT`,
    
    // Exchange missing columns  
    `ALTER TABLE "Exchange" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT`,
    `ALTER TABLE "Exchange" ADD COLUMN IF NOT EXISTS "newOrderId" TEXT`,
    
    // Customer missing columns
    `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "storeCredits" DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "storeCreditPreference" BOOLEAN DEFAULT false`,

    // Product & OrderItem image support
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "featuredImage" TEXT`,
    `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "image" TEXT`,
  ];
  
  console.log('Adding missing columns to production database...\n');
  
  for (const q of queries) {
    try {
      await pool.query(q);
      // Extract table and column name from query
      const match = q.match(/"(\w+)".*"(\w+)"/);
      console.log(`  ✓ ${match ? match[1] + '.' + match[2] : 'OK'}`);
    } catch (e) {
      console.log(`  ⚠ ${e.message.substring(0, 80)}`);
    }
  }
  
  console.log('\nDone!');
  pool.end();
}

migrate().catch(e => {
  console.error('Fatal:', e.message);
  pool.end();
});
