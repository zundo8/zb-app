const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

dotenv.config({ path: '.env.local' });

async function main() {
  const pgUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  const sanitizedPgUrl = pgUrl.includes('sslmode=require') 
    ? pgUrl.replace('sslmode=require', 'sslmode=no-verify')
    : pgUrl;
    
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  const pool = new Pool({
    connectionString: sanitizedPgUrl,
    ssl: { rejectUnauthorized: false },
  });
  
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  console.log('Connecting to database...');
  
  const returns = await prisma.returnRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { order: true }
  });

  console.log(`\n--- RECENT RETURN REQUESTS ---`);
  for (const r of returns) {
    console.log(`Return ID: ${r.id} | Status: ${r.status} | Order ID: ${r.orderId} | Order Status: ${r.order?.status} | Order DeliveryStatus: ${r.order?.deliveryStatus}`);
  }

  const exchanges = await prisma.exchangeRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { order: true }
  });

  console.log(`\n--- RECENT EXCHANGE REQUESTS ---`);
  for (const e of exchanges) {
    console.log(`Exchange ID: ${e.id} | Status: ${e.status} | Order ID: ${e.orderId} | Order Status: ${e.order?.status} | Order DeliveryStatus: ${e.order?.deliveryStatus}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
});
