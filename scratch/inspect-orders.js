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
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`Found ${orders.length} orders:`);
  for (const o of orders) {
    console.log(`- ID: ${o.id} | Status: ${o.status} | DeliveryStatus: ${o.deliveryStatus} | FulfillmentStatus: ${o.fulfillmentStatus}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
});
