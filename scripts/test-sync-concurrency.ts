#!/usr/bin/env ts-node
import './load-env';
import prisma from '../lib/db';
import { syncOrderToShopify } from '../lib/services/shopifyOrderSyncService';

async function runConcurrencyTests() {
  console.log('====================================================');
  console.log('🧪 SHOPIFY SYNC CONCURRENCY & IDEMPOTENCY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ✓ ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ✗ ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // Find or create a shop and customer for testing
  const shop = await prisma.shop.findFirst();
  if (!shop) {
    throw new Error('No shop found in database to run tests against');
  }

  let customer = await prisma.customer.findFirst();
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        shopId: shop.id,
        email: 'test_concurrency@example.com',
        name: 'Test Concurrency',
      },
    });
  }

  // -----------------------------------------------------------------
  // Test 1: Atomic Claim Primitive (Compare-and-Set Lock)
  // -----------------------------------------------------------------
  console.log('--- TEST 1: Atomic Compare-and-Set Claim Concurrency ---');
  const testOrder1 = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      shopifyOrderId: null,
      internalOrderNumber: `TEST_CONC_${Date.now()}`,
      status: 'pending',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      totalPrice: 999,
      shopifySyncStatus: 'pending',
    },
  });

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Run two atomic claim queries simultaneously
    const [claimA, claimB] = await Promise.all([
      prisma.order.updateMany({
        where: {
          id: testOrder1.id,
          shopifyOrderId: null,
          OR: [
            { shopifySyncStatus: { not: 'syncing' } },
            { updatedAt: { lt: fiveMinutesAgo } },
          ],
        },
        data: { shopifySyncStatus: 'syncing' },
      }),
      prisma.order.updateMany({
        where: {
          id: testOrder1.id,
          shopifyOrderId: null,
          OR: [
            { shopifySyncStatus: { not: 'syncing' } },
            { updatedAt: { lt: fiveMinutesAgo } },
          ],
        },
        data: { shopifySyncStatus: 'syncing' },
      }),
    ]);

    const totalClaimsWon = claimA.count + claimB.count;
    console.log(`Claim results: Caller A = ${claimA.count}, Caller B = ${claimB.count}`);

    assert(totalClaimsWon === 1, 'Exactly ONE caller acquires the atomic "syncing" claim');
    assert((claimA.count === 1 && claimB.count === 0) || (claimA.count === 0 && claimB.count === 1), 'One winner (1) and one loser (0)');

    const stateAfterClaim = await prisma.order.findUnique({
      where: { id: testOrder1.id },
      select: { shopifySyncStatus: true },
    });
    assert(stateAfterClaim?.shopifySyncStatus === 'syncing', 'Order state transitioned to "syncing"');
  } finally {
    await prisma.order.delete({ where: { id: testOrder1.id } }).catch(() => {});
  }

  // -----------------------------------------------------------------
  // Test 2: syncOrderToShopify Rejection of Concurrent Claim
  // -----------------------------------------------------------------
  console.log('\n--- TEST 2: syncOrderToShopify Rejection When Claimed ---');
  const testOrder2 = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      shopifyOrderId: null,
      internalOrderNumber: `TEST_LOCK_${Date.now()}`,
      status: 'pending',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      totalPrice: 1499,
      shopifySyncStatus: 'syncing', // Already claimed by another worker
    },
  });

  try {
    const syncResult = await syncOrderToShopify(testOrder2.id);
    console.log('Result when syncing already-claimed order:', syncResult);

    assert(syncResult.success === false, 'syncOrderToShopify returns success: false for claimed order');
    assert(syncResult.skippedDuplicate === true, 'syncOrderToShopify flags skippedDuplicate: true');
    assert(syncResult.error?.includes('already in progress') || false, 'Error message indicates sync in progress');
  } finally {
    await prisma.order.delete({ where: { id: testOrder2.id } }).catch(() => {});
  }

  // -----------------------------------------------------------------
  // Test 3: Fast-Path Idempotency for Already-Synced Orders
  // -----------------------------------------------------------------
  console.log('\n--- TEST 3: Fast-Path Idempotency for Synced Orders ---');
  const testOrder3 = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      shopifyOrderId: '6208493029102', // Valid numeric Shopify ID
      shopifyOrderName: '#ZB99999',
      internalOrderNumber: 'ZB99999',
      status: 'open',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      totalPrice: 1999,
      shopifySyncStatus: 'synced',
    },
  });

  try {
    const syncResult = await syncOrderToShopify(testOrder3.id);
    console.log('Result for already-synced order:', syncResult);

    assert(syncResult.success === true, 'Fast-path returns success: true');
    assert(syncResult.shopifyOrderId === '6208493029102', 'Preserves existing numeric shopifyOrderId');
    assert(syncResult.shopifyOrderName === '#ZB99999', 'Preserves existing shopifyOrderName');
  } finally {
    await prisma.order.delete({ where: { id: testOrder3.id } }).catch(() => {});
  }

  // -----------------------------------------------------------------
  // Test 4: Atomic Universal Order Number Promotion (Double-Mint Guard)
  // -----------------------------------------------------------------
  console.log('\n--- TEST 4: Atomic Universal Order Number Promotion Race ---');
  const tempOrderNumber = `FAIL${Date.now().toString().slice(-6)}`;
  const testOrder4 = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      shopifyOrderId: null,
      internalOrderNumber: tempOrderNumber,
      status: 'pending',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      totalPrice: 2159,
      shopifySyncStatus: 'pending',
    },
  });

  try {
    const mintedA = 'ZB72044';
    const mintedB = 'ZB72045';

    // Simulate checkout/complete and webhook concurrently attempting to promote the order number
    const [resultA, resultB] = await Promise.all([
      prisma.order.updateMany({
        where: { id: testOrder4.id, internalOrderNumber: tempOrderNumber },
        data: { internalOrderNumber: mintedA },
      }),
      prisma.order.updateMany({
        where: { id: testOrder4.id, internalOrderNumber: tempOrderNumber },
        data: { internalOrderNumber: mintedB },
      }),
    ]);

    console.log(`Promotion results: Attempt A (${mintedA}) = ${resultA.count}, Attempt B (${mintedB}) = ${resultB.count}`);

    assert(resultA.count + resultB.count === 1, 'Exactly ONE process promotes the temporary order number');
    assert((resultA.count === 1 && resultB.count === 0) || (resultA.count === 0 && resultB.count === 1), 'One winner and one loser');

    const finalOrder = await prisma.order.findUnique({
      where: { id: testOrder4.id },
      select: { internalOrderNumber: true },
    });

    const expectedWinner = resultA.count === 1 ? mintedA : mintedB;
    assert(finalOrder?.internalOrderNumber === expectedWinner, `Final order number matches winner (${expectedWinner}) without double minting`);
  } finally {
    await prisma.order.delete({ where: { id: testOrder4.id } }).catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runConcurrencyTests()
  .catch((e) => {
    console.error('Fatal Test Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
