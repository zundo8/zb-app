/**
 * scripts/reconcile-order-numbers.ts
 *
 * One-time reconciliation script for Order ↔ WebStoreOrder number divergence
 * caused by the 3dbf077 regression.
 *
 * Finds every Order whose internalOrderNumber doesn't match the corresponding
 * WebStoreOrder.orderNumber (matched via razorpayOrderId or notes markers),
 * and optionally updates the stale WebStoreOrder.orderNumber to match.
 *
 * The Order table is treated as source of truth (it's what customer-facing
 * /api/orders and Shopify tags both key off).
 *
 * Usage:
 *   npx tsx scripts/reconcile-order-numbers.ts             # dry-run (read-only)
 *   npx tsx scripts/reconcile-order-numbers.ts --apply      # apply fixes
 */

import prisma from '../lib/db';

interface DivergenceRecord {
  orderId: string;
  razorpayOrderId: string | null;
  orderInternalNumber: string | null;
  webStoreOrderId: string;
  webStoreOrderNumber: string;
  action: string;
}

async function main() {
  const applyMode = process.argv.includes('--apply');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  Order ↔ WebStoreOrder Number Reconciliation                ║`);
  console.log(`║  Mode: ${applyMode ? '🔧 APPLY (will write to DB)' : '👁️  DRY-RUN (read-only)'}                       ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── Step 1: Find all Orders that have a corresponding WebStoreOrder ──

  const allOrders = await prisma.order.findMany({
    where: {
      internalOrderNumber: { not: null },
    },
    select: {
      id: true,
      internalOrderNumber: true,
      razorpayOrderId: true,
      shopifyOrderId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${allOrders.length} orders with internalOrderNumber to check.\n`);

  const divergences: DivergenceRecord[] = [];
  let checked = 0;
  let matched = 0;
  let alreadyInSync = 0;

  for (const order of allOrders) {
    checked++;
    if (checked % 50 === 0) {
      console.log(`  Checked ${checked}/${allOrders.length}...`);
    }

    // Try to find the corresponding WebStoreOrder via multiple lookup strategies
    let webStoreOrder: any = null;

    // Strategy 1: Match by razorpayOrderId
    if (order.razorpayOrderId) {
      webStoreOrder = await prisma.webStoreOrder.findFirst({
        where: { razorpayOrderId: order.razorpayOrderId },
        select: { id: true, orderNumber: true, razorpayOrderId: true },
      });
    }

    // Strategy 2: Match by notes containing Local: {orderId}
    if (!webStoreOrder) {
      webStoreOrder = await prisma.webStoreOrder.findFirst({
        where: { notes: { contains: `Local: ${order.id}` } },
        select: { id: true, orderNumber: true, razorpayOrderId: true },
      });
    }

    // Strategy 3: Match by notes containing Shopify: {shopifyOrderId}
    if (!webStoreOrder && order.shopifyOrderId) {
      webStoreOrder = await prisma.webStoreOrder.findFirst({
        where: { notes: { contains: `Shopify: ${order.shopifyOrderId}` } },
        select: { id: true, orderNumber: true, razorpayOrderId: true },
      });
    }

    // Strategy 4: Match by orderNumber (in case they already match)
    if (!webStoreOrder && order.internalOrderNumber) {
      webStoreOrder = await prisma.webStoreOrder.findFirst({
        where: { orderNumber: order.internalOrderNumber },
        select: { id: true, orderNumber: true, razorpayOrderId: true },
      });
    }

    if (!webStoreOrder) continue; // No corresponding WebStoreOrder found — skip

    matched++;

    // Compare numbers
    if (webStoreOrder.orderNumber === order.internalOrderNumber) {
      alreadyInSync++;
      continue;
    }

    // Found a divergence
    divergences.push({
      orderId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      orderInternalNumber: order.internalOrderNumber,
      webStoreOrderId: webStoreOrder.id,
      webStoreOrderNumber: webStoreOrder.orderNumber,
      action: `WebStoreOrder.orderNumber: "${webStoreOrder.orderNumber}" → "${order.internalOrderNumber}"`,
    });
  }

  // ── Step 2: Also check MobileOrder divergences ──

  const mobileOrders = await prisma.mobileOrder.findMany({
    select: {
      id: true,
      orderNumber: true,
      razorpayOrderId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const mobileOrdersWithLinkedOrder: { mobileOrderId: string; mobileOrderNumber: string; orderId: string; orderInternalNumber: string | null }[] = [];

  for (const mo of mobileOrders) {
    if (!mo.razorpayOrderId) continue;
    const linkedOrder = await prisma.order.findFirst({
      where: { razorpayOrderId: mo.razorpayOrderId },
      select: { id: true, internalOrderNumber: true },
    });
    if (linkedOrder && linkedOrder.internalOrderNumber && mo.orderNumber !== linkedOrder.internalOrderNumber) {
      mobileOrdersWithLinkedOrder.push({
        mobileOrderId: mo.id,
        mobileOrderNumber: mo.orderNumber,
        orderId: linkedOrder.id,
        orderInternalNumber: linkedOrder.internalOrderNumber,
      });
    }
  }

  // ── Step 3: Report ──

  console.log(`\n=== Reconciliation Report ===`);
  console.log(`  Orders checked:       ${checked}`);
  console.log(`  WebStoreOrders found: ${matched}`);
  console.log(`  Already in sync:      ${alreadyInSync}`);
  console.log(`  Divergences found:    ${divergences.length}`);
  console.log(`  MobileOrder diverge:  ${mobileOrdersWithLinkedOrder.length}\n`);

  if (divergences.length === 0 && mobileOrdersWithLinkedOrder.length === 0) {
    console.log('✅ All order numbers are in sync. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  if (divergences.length > 0) {
    console.log('── WebStoreOrder Divergences ──\n');
    console.table(divergences.map(d => ({
      orderId: d.orderId.slice(0, 12) + '…',
      'Order.internalOrderNumber': d.orderInternalNumber,
      'WebStoreOrder.orderNumber': d.webStoreOrderNumber,
      'Fix': d.action,
    })));
  }

  if (mobileOrdersWithLinkedOrder.length > 0) {
    console.log('\n── MobileOrder Divergences ──\n');
    console.table(mobileOrdersWithLinkedOrder.map(m => ({
      mobileOrderId: m.mobileOrderId.slice(0, 12) + '…',
      'MobileOrder.orderNumber': m.mobileOrderNumber,
      'Order.internalOrderNumber': m.orderInternalNumber,
    })));
  }

  // ── Step 4: Apply (only if --apply) ──

  if (!applyMode) {
    console.log('\n⚠️  DRY-RUN mode — no changes were made.');
    console.log('    Re-run with --apply to fix divergences:');
    console.log('    npx tsx scripts/reconcile-order-numbers.ts --apply\n');
    await prisma.$disconnect();
    return;
  }

  console.log('\n🔧 Applying fixes...\n');

  let fixed = 0;
  let errors = 0;

  for (const d of divergences) {
    try {
      await prisma.webStoreOrder.update({
        where: { id: d.webStoreOrderId },
        data: { orderNumber: d.orderInternalNumber! },
      });
      fixed++;
      console.log(`  ✅ Fixed WebStoreOrder ${d.webStoreOrderId}: "${d.webStoreOrderNumber}" → "${d.orderInternalNumber}"`);
    } catch (err: any) {
      errors++;
      console.error(`  ❌ Failed to fix WebStoreOrder ${d.webStoreOrderId}: ${err.message}`);
    }
  }

  for (const m of mobileOrdersWithLinkedOrder) {
    try {
      await prisma.mobileOrder.update({
        where: { id: m.mobileOrderId },
        data: { orderNumber: m.orderInternalNumber! },
      });
      fixed++;
      console.log(`  ✅ Fixed MobileOrder ${m.mobileOrderId}: "${m.mobileOrderNumber}" → "${m.orderInternalNumber}"`);
    } catch (err: any) {
      errors++;
      console.error(`  ❌ Failed to fix MobileOrder ${m.mobileOrderId}: ${err.message}`);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  Fixed:  ${fixed}`);
  console.log(`  Errors: ${errors}\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Reconciliation script failed:', err);
  process.exit(1);
});
