import * as dotenv from 'dotenv';

// Load env first
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Connecting to database...');
  const { default: prisma } = await import('../lib/db');
  
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
