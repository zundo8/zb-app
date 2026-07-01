import './load-env';
import prisma from '../lib/db';

async function main() {
  console.log("Starting backfill of internal order numbers...");
  
  // Verify database connection is available
  if (prisma._isMock) {
    throw new Error(`Prisma is mock: ${prisma._mockReason}`);
  }

  // 1. Fetch all orders sorted by createdAt asc
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, internalOrderNumber: true }
  });

  console.log(`Found ${orders.length} total orders to process.`);

  // Group by YYMM
  const groups: Record<string, typeof orders> = {};
  for (const order of orders) {
    const date = new Date(order.createdAt);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;

    if (!groups[yymm]) {
      groups[yymm] = [];
    }
    groups[yymm].push(order);
  }

  const yymmList = Object.keys(groups).sort();
  console.log(`Grouped orders into ${yymmList.length} monthly cohorts:`, yymmList);

  for (const yymm of yymmList) {
    const cohort = groups[yymm];
    console.log(`Processing cohort ${yymm} (${cohort.length} orders)...`);

    let counter = 0;
    for (const order of cohort) {
      counter++;
      const paddedCounter = String(counter).padStart(5, '0');
      const orderNumber = `ZB-${yymm}-${paddedCounter}`;

      // Update in DB if it doesn't already match
      if (order.internalOrderNumber !== orderNumber) {
        await prisma.order.update({
          where: { id: order.id },
          data: { internalOrderNumber: orderNumber }
        });
      }
    }

    // Set sequence value for this cohort
    console.log(`Setting sequence value for ${yymm} to ${counter} in order_sequences...`);
    await prisma.$executeRawUnsafe(`
      INSERT INTO order_sequences (year_month, current_value)
      VALUES ($1, $2)
      ON CONFLICT (year_month)
      DO UPDATE SET current_value = EXCLUDED.current_value;
    `, yymm, counter);
  }

  console.log("Backfill of internal order numbers completed successfully!");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
