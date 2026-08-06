/**
 * scripts/audit-order-number-mismatch.ts
 *
 * READ-ONLY audit script that finds existing Order rows where the local
 * internalOrderNumber does not match the number embedded in Shopify's
 * order tags/note_attributes for the same shopifyOrderId.
 *
 * ⚠️ This script NEVER writes to the database or to Shopify.
 * It only reads and prints/exports a report.
 *
 * Usage:
 *   npx tsx scripts/audit-order-number-mismatch.ts
 *
 * Output:
 *   Prints mismatched orders to stdout as a table.
 *   Optionally writes a CSV to scripts/audit-order-mismatch-report.csv
 */

import prisma from '../lib/db';
import { fetchOrder } from '../lib/shopify-admin';

interface MismatchRecord {
  localOrderId: string;
  shopifyOrderId: string;
  localNumber: string | null;
  shopifyTagNumber: string | null;
  shopifyNoteAttrNumber: string | null;
}

async function main() {
  console.log('=== Order Number Mismatch Audit (READ-ONLY) ===\n');

  // Fetch all orders that have a shopifyOrderId
  const orders = await prisma.order.findMany({
    where: {
      shopifyOrderId: { not: null },
    },
    select: {
      id: true,
      shopifyOrderId: true,
      internalOrderNumber: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${orders.length} orders with Shopify IDs to audit.\n`);

  const mismatches: MismatchRecord[] = [];
  let checked = 0;
  let errors = 0;

  for (const order of orders) {
    checked++;
    if (checked % 25 === 0) {
      console.log(`  Checked ${checked}/${orders.length}...`);
    }

    if (!order.shopifyOrderId) continue;

    // Skip temp/local shopify IDs
    if (
      order.shopifyOrderId.startsWith('#') ||
      order.shopifyOrderId.startsWith('app_pending_') ||
      order.shopifyOrderId.startsWith('local_')
    ) {
      continue;
    }

    try {
      const shopifyOrder = await fetchOrder(order.shopifyOrderId);
      if (!shopifyOrder) continue;

      // Extract number from Shopify tags (look for zb-order-XXXXX)
      const tags = shopifyOrder.tags || '';
      const tagMatch = tags.match(/zb-order-(ZB\w+)/);
      const shopifyTagNumber = tagMatch ? tagMatch[1] : null;

      // Extract from note_attributes
      const noteAttrs: any[] = (shopifyOrder as any).note_attributes || [];
      const noteAttr = noteAttrs.find(
        (a: any) => a.name === 'internal_order_number'
      );
      const shopifyNoteAttrNumber = noteAttr ? noteAttr.value : null;

      const localNumber = order.internalOrderNumber;

      // Check for mismatch
      const tagMismatch = shopifyTagNumber && localNumber && shopifyTagNumber !== localNumber;
      const noteMismatch = shopifyNoteAttrNumber && localNumber && shopifyNoteAttrNumber !== localNumber;

      if (tagMismatch || noteMismatch) {
        mismatches.push({
          localOrderId: order.id,
          shopifyOrderId: order.shopifyOrderId,
          localNumber,
          shopifyTagNumber,
          shopifyNoteAttrNumber,
        });
      }

      // Rate limiting: avoid hammering Shopify API
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (err: any) {
      errors++;
      if (errors <= 5) {
        console.warn(
          `  ⚠️ Error fetching Shopify order ${order.shopifyOrderId}: ${err.message}`
        );
      }
    }
  }

  console.log(`\n=== Audit Complete ===`);
  console.log(`  Total checked: ${checked}`);
  console.log(`  Fetch errors:  ${errors}`);
  console.log(`  Mismatches:    ${mismatches.length}\n`);

  if (mismatches.length === 0) {
    console.log('✅ No mismatches found. All local and Shopify order numbers match.');
  } else {
    console.log('❌ Mismatched orders:\n');
    console.table(mismatches);

    // Write CSV
    const fs = await import('fs');
    const csvLines = [
      'localOrderId,shopifyOrderId,localNumber,shopifyTagNumber,shopifyNoteAttrNumber',
      ...mismatches.map(
        (m) =>
          `${m.localOrderId},${m.shopifyOrderId},${m.localNumber || ''},${m.shopifyTagNumber || ''},${m.shopifyNoteAttrNumber || ''}`
      ),
    ];
    const csvPath = 'scripts/audit-order-mismatch-report.csv';
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
    console.log(`\n📄 Report saved to: ${csvPath}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
