#!/usr/bin/env ts-node
import './load-env';
import prisma from '../lib/db';
import { fetchAllOrders, cancelOrder, updateOrderTags, shopifyFetch } from '../lib/shopify-admin';

interface DuplicateCluster {
  clusterKey: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  totalPrice: number;
  timeSpanMinutes: number;
  winnerOrder: OrderInfo;
  duplicateOrders: OrderInfo[];
  reason: string;
}

interface OrderInfo {
  source: 'shopify' | 'database';
  id: string;
  orderNumber: string;
  createdAt: Date;
  totalPrice: number;
  financialStatus: string;
  fulfillmentStatus: string | null;
  delhiveryAwb?: string | null;
  itemsSummary: string;
  tags?: string;
  note?: string;
  raw?: any;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 14;
  let customerFilter = '';
  let fix = false;
  let confirmFix = false;
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      days = parseInt(arg.split('=')[1], 10) || 14;
    } else if (arg.startsWith('--customer=')) {
      customerFilter = arg.split('=')[1].toLowerCase();
    } else if (arg === '--fix') {
      fix = true;
    } else if (arg === '--confirm-fix') {
      confirmFix = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    }
  }

  return { days, customerFilter, fix, confirmFix, verbose };
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function runAudit() {
  const { days, customerFilter, fix, confirmFix, verbose } = parseArgs();

  console.log(`\n===============================================================`);
  console.log(`🔍 SHOPIFY & LOCAL ORDER DUPLICATE AUDIT TOOL`);
  console.log(`===============================================================`);
  console.log(`Window: Past ${days} days`);
  console.log(`Mode: ${fix ? (confirmFix ? '⚠️ EXECUTE FIX' : '⚠️ FIX REQUESTED (DRY RUN - missing --confirm-fix)') : '🔒 READ-ONLY (DRY RUN)'}`);
  if (customerFilter) console.log(`Filter: Customer matching "${customerFilter}"`);
  console.log(`---------------------------------------------------------------\n`);

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1. Fetch Shopify Orders
  console.log(`[1/3] Fetching Shopify orders created since ${cutoffDate.toISOString().slice(0, 10)}...`);
  let shopifyOrders: any[] = [];
  try {
    const fetched = await fetchAllOrders(250);
    shopifyOrders = fetched.filter((o: any) => new Date(o.created_at) >= cutoffDate);
    console.log(`      Fetched ${shopifyOrders.length} Shopify orders in target window.`);
  } catch (err: any) {
    console.warn(`      ⚠️ Could not fetch all Shopify orders via fetchAllOrders: ${err.message}. Trying direct query...`);
    try {
      const res = await shopifyFetch<{ orders: any[] }>(`orders.json?status=any&created_at_min=${cutoffDate.toISOString()}&limit=250`);
      shopifyOrders = res.orders || [];
      console.log(`      Fetched ${shopifyOrders.length} Shopify orders via direct API.`);
    } catch (apiErr: any) {
      console.error(`      ❌ Failed to fetch Shopify orders: ${apiErr.message}`);
    }
  }

  // 2. Fetch Database Orders
  console.log(`[2/3] Fetching local database orders...`);
  const dbOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: cutoffDate },
    },
    include: {
      customer: true,
      items: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`      Fetched ${dbOrders.length} database orders.`);

  // 3. Normalize into OrderInfo list
  const allOrderInfos: OrderInfo[] = [];

  for (const so of shopifyOrders) {
    const custName = `${so.customer?.first_name || ''} ${so.customer?.last_name || ''}`.trim() || so.shipping_address?.name || 'Unknown';
    const itemsSummary = (so.line_items || []).map((li: any) => `${li.quantity}x ${li.title} (${li.variant_title || 'default'})`).join(', ');
    allOrderInfos.push({
      source: 'shopify',
      id: String(so.id),
      orderNumber: so.name || `#${so.order_number}`,
      createdAt: new Date(so.created_at),
      totalPrice: parseFloat(so.total_price || '0'),
      financialStatus: so.financial_status || 'unknown',
      fulfillmentStatus: so.fulfillment_status || null,
      delhiveryAwb: null,
      itemsSummary,
      tags: so.tags || '',
      note: so.note || '',
      raw: so,
    });
  }

  // 4. Cluster Detection
  console.log(`[3/3] Analyzing for duplicate clusters (matching customer + same price within 30 min window)...`);

  const clusters: DuplicateCluster[] = [];
  const processedShopifyIds = new Set<string>();

  // Group Shopify orders by candidate similarity
  for (let i = 0; i < allOrderInfos.length; i++) {
    const a = allOrderInfos[i];
    if (processedShopifyIds.has(a.id)) continue;

    const aRaw = a.raw;
    const aCustName = normalizeText(`${aRaw.customer?.first_name || ''} ${aRaw.customer?.last_name || ''}` || aRaw.shipping_address?.name);
    const aEmail = normalizeText(aRaw.email || aRaw.customer?.email);
    const aPhone = normalizePhone(aRaw.phone || aRaw.customer?.phone || aRaw.shipping_address?.phone);

    const matches: OrderInfo[] = [a];

    for (let j = i + 1; j < allOrderInfos.length; j++) {
      const b = allOrderInfos[j];
      if (processedShopifyIds.has(b.id)) continue;

      const bRaw = b.raw;
      const bCustName = normalizeText(`${bRaw.customer?.first_name || ''} ${bRaw.customer?.last_name || ''}` || bRaw.shipping_address?.name);
      const bEmail = normalizeText(bRaw.email || bRaw.customer?.email);
      const bPhone = normalizePhone(bRaw.phone || bRaw.customer?.phone || bRaw.shipping_address?.phone);

      // Criteria:
      // 1. Same customer (Email, Phone, or Name match)
      const sameCustomer = (aEmail && bEmail && aEmail === bEmail) ||
                           (aPhone && bPhone && aPhone === bPhone) ||
                           (aCustName && bCustName && aCustName === bCustName && aCustName !== 'unknown');

      // 2. Same total price (rounded to nearest rupee)
      const samePrice = Math.abs(a.totalPrice - b.totalPrice) < 1.0;

      // 3. Created within 30 minutes of each other
      const timeDiffMs = Math.abs(a.createdAt.getTime() - b.createdAt.getTime());
      const withinTimeWindow = timeDiffMs <= 30 * 60 * 1000;

      // 4. Or identical cart note / internal number reference
      const sameCartOrNote = (a.note && b.note && a.note.includes(b.orderNumber)) ||
                             (a.tags && b.tags && a.tags.includes(b.orderNumber));

      if ((sameCustomer && samePrice && withinTimeWindow) || sameCartOrNote) {
        matches.push(b);
      }
    }

    if (matches.length > 1) {
      for (const m of matches) processedShopifyIds.add(m.id);

      // Determine winner:
      // - Order with fulfillment or tracking
      // - Or order already linked to a confirmed DB record
      // - Otherwise earliest created
      matches.sort((x, y) => {
        const xFulfilled = x.fulfillmentStatus === 'fulfilled' ? 2 : (x.fulfillmentStatus ? 1 : 0);
        const yFulfilled = y.fulfillmentStatus === 'fulfilled' ? 2 : (y.fulfillmentStatus ? 1 : 0);
        if (xFulfilled !== yFulfilled) return yFulfilled - xFulfilled;
        return x.createdAt.getTime() - y.createdAt.getTime();
      });

      const winner = matches[0];
      const duplicates = matches.slice(1);
      const timeSpanMinutes = Math.round(
        (matches[matches.length - 1].createdAt.getTime() - matches[0].createdAt.getTime()) / (60 * 1000)
      );

      const customerDisplay = `${aRaw.customer?.first_name || ''} ${aRaw.customer?.last_name || ''}`.trim() ||
                              aRaw.shipping_address?.name || aEmail || aPhone || 'Customer';

      if (!customerFilter || normalizeText(customerDisplay).includes(customerFilter)) {
        clusters.push({
          clusterKey: `${winner.orderNumber}-${duplicates.map(d => d.orderNumber).join('-')}`,
          customerName: customerDisplay,
          customerEmail: aEmail,
          customerPhone: aPhone,
          totalPrice: winner.totalPrice,
          timeSpanMinutes,
          winnerOrder: winner,
          duplicateOrders: duplicates,
          reason: `Identical price (₹${winner.totalPrice}) and customer within ${timeSpanMinutes} min window`,
        });
      }
    }
  }

  // 5. Present Results
  console.log(`\n===============================================================`);
  console.log(`📊 AUDIT SUMMARY: Found ${clusters.length} duplicate cluster(s)`);
  console.log(`===============================================================\n`);

  if (clusters.length === 0) {
    console.log(`✅ No duplicate Shopify order clusters detected in the past ${days} days!`);
    return;
  }

  for (let idx = 0; idx < clusters.length; idx++) {
    const c = clusters[idx];
    const isReportedCase = c.winnerOrder.orderNumber.includes('ZB72044') ||
                           c.winnerOrder.orderNumber.includes('ZB72045') ||
                           c.duplicateOrders.some(d => d.orderNumber.includes('ZB72044') || d.orderNumber.includes('ZB72045')) ||
                           normalizeText(c.customerName).includes('majeda');

    console.log(`---------------------------------------------------------------`);
    console.log(`Cluster #${idx + 1}${isReportedCase ? ' 🚨 [REPORTED USER CASE DETECTED]' : ''}`);
    console.log(`Customer: ${c.customerName} | Phone: ${c.customerPhone || 'N/A'} | Email: ${c.customerEmail || 'N/A'}`);
    console.log(`Amount: ₹${c.totalPrice.toFixed(2)} | Time Span: ${c.timeSpanMinutes} minutes apart`);
    console.log(`Reason: ${c.reason}`);
    console.log(``);
    console.log(`  🏆 PRIMARY / WINNER ORDER:`);
    console.log(`     - Order: ${c.winnerOrder.orderNumber} (Shopify ID: ${c.winnerOrder.id})`);
    console.log(`     - Created: ${c.winnerOrder.createdAt.toLocaleTimeString()} (${c.winnerOrder.createdAt.toISOString()})`);
    console.log(`     - Financial: ${c.winnerOrder.financialStatus} | Fulfillment: ${c.winnerOrder.fulfillmentStatus || 'unfulfilled'}`);
    console.log(`     - Items: ${c.winnerOrder.itemsSummary}`);
    console.log(`     - Tags: ${c.winnerOrder.tags || 'none'}`);
    console.log(``);
    console.log(`  🚫 DUPLICATE ORDER(S):`);
    for (const dup of c.duplicateOrders) {
      console.log(`     - Order: ${dup.orderNumber} (Shopify ID: ${dup.id})`);
      console.log(`     - Created: ${dup.createdAt.toLocaleTimeString()} (${dup.createdAt.toISOString()})`);
      console.log(`     - Financial: ${dup.financialStatus} | Fulfillment: ${dup.fulfillmentStatus || 'unfulfilled'}`);
      console.log(`     - Items: ${dup.itemsSummary}`);
      console.log(`     - Tags: ${dup.tags || 'none'}`);
    }
    console.log(`---------------------------------------------------------------`);

    // Fix execution if enabled and confirmed
    if (fix && confirmFix) {
      console.log(`  🔧 EXECUTING FIX FOR CLUSTER #${idx + 1}...`);
      for (const dup of c.duplicateOrders) {
        if (dup.fulfillmentStatus === 'fulfilled') {
          console.warn(`     ⚠️ Skipping ${dup.orderNumber} - Already fulfilled! Manual review required.`);
          continue;
        }

        try {
          console.log(`     1. Cancelling duplicate Shopify order ${dup.orderNumber} (${dup.id})...`);
          await cancelOrder(dup.id, 'customer');

          console.log(`     2. Tagging Shopify order with DUPLICATE_CANCELLED...`);
          const existingTags = dup.tags ? `${dup.tags}, ` : '';
          const newTags = `${existingTags}DUPLICATE_CANCELLED, CANCELLED_IN_FAVOR_OF_${c.winnerOrder.orderNumber}`;
          await updateOrderTags(dup.id, newTags);

          console.log(`     3. Updating any local database records linked to ${dup.id}...`);
          const dbRec = await prisma.order.findFirst({
            where: {
              OR: [
                { shopifyOrderId: dup.id },
                { shopifyOrderName: dup.orderNumber },
              ],
            },
          });
          if (dbRec) {
            await prisma.order.update({
              where: { id: dbRec.id },
              data: {
                status: 'cancelled',
                shopifySyncError: `Cancelled duplicate in favor of ${c.winnerOrder.orderNumber} (${c.winnerOrder.id})`,
              },
            });
            console.log(`        Updated local Order ${dbRec.id} status to 'cancelled'.`);
          }

          console.log(`     ✅ Successfully reconciled duplicate order ${dup.orderNumber}.`);
        } catch (fixErr: any) {
          console.error(`     ❌ Failed to fix duplicate ${dup.orderNumber}:`, fixErr.message);
        }
      }
    } else if (fix && !confirmFix) {
      console.log(`  ⚠️ Dry run: To execute fix for this cluster, run with --confirm-fix flag:`);
      console.log(`     npx ts-node scripts/audit-duplicate-shopify-orders.ts --customer="${c.customerName}" --fix --confirm-fix`);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🏁 AUDIT COMPLETE`);
  console.log(`===============================================================\n`);
}

runAudit()
  .catch((e) => {
    console.error('Audit Script Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
