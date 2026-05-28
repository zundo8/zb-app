/**
 * Import Orders from Shopify CSV Export into the Postgres database.
 * 
 * This script:
 * 1. Reads orders_export_1.csv
 * 2. Creates/upserts customers by email or phone
 * 3. Creates orders with proper line items, shipping addresses, payment info
 * 4. Groups multi-line-item orders (same order number, multiple CSV rows)
 * 
 * Usage: node scripts/import-orders-csv.js
 */

// Load env first
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Determine the Postgres URL
const pgUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')
    ? process.env.DATABASE_URL
    : undefined);

if (!pgUrl) {
  console.error('✗ No Postgres URL found. Set POSTGRES_PRISMA_URL or POSTGRES_URL.');
  process.exit(1);
}

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = pgUrl;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let prisma;
try {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const pool = new Pool({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
  });
  prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ['error'],
  });
} catch (e) {
  console.error('✗ Prisma init error:', e.message);
  process.exit(1);
}

// ─── CSV Parser (handles quoted fields with embedded commas/newlines) ───
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        if (ch === '\r') i++; // skip \n after \r
      } else {
        currentField += ch;
      }
    }
  }
  // Last row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }
  return rows;
}

// Map CSV header to index
function headerMap(headers) {
  const map = {};
  headers.forEach((h, i) => { map[h.trim()] = i; });
  return map;
}

function getVal(row, hMap, key) {
  const idx = hMap[key];
  return idx !== undefined ? (row[idx] || '').trim() : '';
}

function parseFloat2(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function parseInt2(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function normalizePhone(p) {
  if (!p) return null;
  const digits = p.replace(/\D/g, '');
  if (digits.length >= 10) {
    return '+' + digits;
  }
  return null;
}

function mapFulfillmentToDeliveryStatus(fulfillment, financialStatus, cancelledAt) {
  if (cancelledAt) return 'cancelled';
  const f = (fulfillment || '').toLowerCase();
  if (f === 'fulfilled') return 'delivered';
  if (f === 'partial') return 'shipped';
  return 'pending';
}

function mapFinancialToStatus(financial, cancelledAt) {
  if (cancelledAt) return 'CANCELLED';
  const f = (financial || '').toLowerCase();
  if (f === 'paid') return 'PAID';
  if (f === 'refunded' || f === 'partially_refunded') return 'REFUNDED';
  if (f === 'voided') return 'CANCELLED';
  if (f === 'pending') return 'PENDING';
  return 'PENDING';
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   ZicaBella Order CSV Importer                      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('  DB:', pgUrl.replace(/:[^:@]+@/, ':***@').substring(0, 80) + '...');

  // Ensure shop exists
  let shop = await prisma.shop.findFirst();
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        domain: process.env.SHOPIFY_STORE_DOMAIN || '8tiahf-bk.myshopify.com',
        accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
      }
    });
    console.log('✓ Created shop:', shop.domain);
  } else {
    console.log('✓ Using shop:', shop.domain);
  }

  // Read CSV
  const csvPath = path.join(__dirname, '..', 'orders_export_1-2.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('✗ CSV file not found at:', csvPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const allRows = parseCSV(raw);
  
  if (allRows.length < 2) {
    console.error('✗ CSV has no data rows');
    process.exit(1);
  }

  const headers = allRows[0];
  const hMap = headerMap(headers);
  const dataRows = allRows.slice(1);

  console.log(`\n📊 CSV has ${dataRows.length} data rows`);

  // Group rows by order name (e.g. #ZB71451)
  const orderGroups = new Map();
  for (const row of dataRows) {
    const orderName = getVal(row, hMap, 'Name');
    if (!orderName) continue;
    if (!orderGroups.has(orderName)) {
      orderGroups.set(orderName, []);
    }
    orderGroups.get(orderName).push(row);
  }

  console.log(`📦 Found ${orderGroups.size} unique orders\n`);

  // Cache for customer resolution
  const customerCache = new Map(); // key: email or phone -> customer record
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  console.log('⚡ Loading database records into memory for fast lookup...');
  const [dbProducts, dbCustomersList, dbOrdersList, dbMobileOrdersList, dbAddressesList] = await Promise.all([
    prisma.product.findMany({ select: { id: true, sku: true, title: true } }),
    prisma.customer.findMany({ select: { id: true, shopifyId: true, email: true, phone: true, name: true, shopId: true } }),
    prisma.order.findMany({ select: { id: true, shopifyOrderId: true } }),
    prisma.mobileOrder.findMany({ select: { id: true, orderNumber: true, shopifyOrderId: true } }),
    prisma.address.findMany({ select: { id: true, customerId: true, address1: true, city: true, zip: true } })
  ]);

  console.log(`   Loaded ${dbProducts.length} products, ${dbCustomersList.length} customers, ${dbOrdersList.length} orders, ${dbMobileOrdersList.length} mobile orders, and ${dbAddressesList.length} addresses.`);

  // Create fast lookup maps/sets
  const productSkuMap = new Map(dbProducts.filter(p => p.sku).map(p => [p.sku.toLowerCase(), p.id]));
  const productTitleMap = new Map(dbProducts.filter(p => p.title).map(p => [p.title.toLowerCase(), p.id]));
  
  // Existing Orders
  const existingShopifyOrders = new Map(dbOrdersList.map(o => [o.shopifyOrderId, o.id]));
  const existingMobileOrders = new Map(dbMobileOrdersList.map(o => [o.orderNumber, o]));
  
  // Existing Addresses
  const addressKey = (customerId, addr1, city, zip) => `${customerId}_${(addr1 || '').toLowerCase()}_${(city || '').toLowerCase()}_${(zip || '').toLowerCase()}`;
  const existingAddressesSet = new Set(dbAddressesList.map(a => addressKey(a.customerId, a.address1, a.city, a.zip)));

  // Populate customerCache with existing DB customers
  for (const c of dbCustomersList) {
    if (c.email) customerCache.set(c.email.toLowerCase(), c);
    if (c.phone) customerCache.set(c.phone, c);
    if (c.name) customerCache.set(c.name.toLowerCase(), c);
  }

  for (const [orderName, rows] of orderGroups) {
    const primaryRow = rows[0]; // First row has the main order data
    
    try {
      const email = getVal(primaryRow, hMap, 'Email');
      const phone = normalizePhone(getVal(primaryRow, hMap, 'Phone') || getVal(primaryRow, hMap, 'Billing Phone'));
      const billingName = getVal(primaryRow, hMap, 'Billing Name');
      const shippingName = getVal(primaryRow, hMap, 'Shipping Name');
      const financialStatus = getVal(primaryRow, hMap, 'Financial Status');
      const fulfillmentStatus = getVal(primaryRow, hMap, 'Fulfillment Status');
      const cancelledAt = getVal(primaryRow, hMap, 'Cancelled at');
      const createdAt = getVal(primaryRow, hMap, 'Created at');
      const totalPrice = parseFloat2(getVal(primaryRow, hMap, 'Total'));
      const subtotal = parseFloat2(getVal(primaryRow, hMap, 'Subtotal'));
      const taxes = parseFloat2(getVal(primaryRow, hMap, 'Taxes'));
      const shipping = parseFloat2(getVal(primaryRow, hMap, 'Shipping'));
      const discountAmount = parseFloat2(getVal(primaryRow, hMap, 'Discount Amount'));
      const discountCode = getVal(primaryRow, hMap, 'Discount Code');
      const currency = getVal(primaryRow, hMap, 'Currency') || 'INR';
      const paymentMethod = getVal(primaryRow, hMap, 'Payment Method');
      const shippingMethod = getVal(primaryRow, hMap, 'Shipping Method');
      const tags = getVal(primaryRow, hMap, 'Tags');
      const notes = getVal(primaryRow, hMap, 'Notes');
      const shopifyId = getVal(primaryRow, hMap, 'Id');

      // Build shopify order ID from order name
      const shopifyOrderId = orderName; // e.g. #ZB71451

      // ─── Resolve/Create Customer ───
      let customer = null;
      if (email && customerCache.has(email.toLowerCase())) {
        customer = customerCache.get(email.toLowerCase());
      } else if (phone && customerCache.has(phone)) {
        customer = customerCache.get(phone);
      } else if (billingName && customerCache.has(billingName.toLowerCase())) {
        customer = customerCache.get(billingName.toLowerCase());
      }

      if (!customer) {
        // Create new customer
        const customerShopifyId = shopifyId ? `csv_${shopifyId}` : `csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        customer = await prisma.customer.create({
          data: {
            shopifyId: customerShopifyId,
            shopId: shop.id,
            email: email || null,
            name: billingName || shippingName || 'Customer',
            phone: phone || null,
          }
        });
        
        // Add to cache
        if (email) customerCache.set(email.toLowerCase(), customer);
        if (phone) customerCache.set(phone, customer);
        if (billingName) customerCache.set(billingName.toLowerCase(), customer);
      } else {
        // Update customer details if empty in db
        let needsUpdate = false;
        const updateData = {};
        if ((!customer.name || customer.name === 'Customer') && (billingName || shippingName)) {
          updateData.name = billingName || shippingName;
          needsUpdate = true;
        }
        if (!customer.phone && phone) {
          updateData.phone = phone;
          needsUpdate = true;
        }
        if (!customer.email && email) {
          updateData.email = email;
          needsUpdate = true;
        }
        if (needsUpdate) {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updateData
          });
          // Update in cache
          if (email) customerCache.set(email.toLowerCase(), customer);
          if (phone) customerCache.set(phone, customer);
          if (billingName) customerCache.set(billingName.toLowerCase(), customer);
        }
      }

      // ─── Build Shipping Address JSON ───
      const shippingAddress = JSON.stringify({
        name: shippingName || billingName,
        address1: getVal(primaryRow, hMap, 'Shipping Address1'),
        address2: getVal(primaryRow, hMap, 'Shipping Address2'),
        city: getVal(primaryRow, hMap, 'Shipping City'),
        province: getVal(primaryRow, hMap, 'Shipping Province Name') || getVal(primaryRow, hMap, 'Shipping Province'),
        zip: (getVal(primaryRow, hMap, 'Shipping Zip') || '').replace(/'/g, ''),
        country: getVal(primaryRow, hMap, 'Shipping Country'),
        phone: normalizePhone(getVal(primaryRow, hMap, 'Shipping Phone')) || phone,
      });

      // ─── Build Billing Address JSON ───
      const billingAddress = JSON.stringify({
        name: billingName,
        address1: getVal(primaryRow, hMap, 'Billing Address1'),
        address2: getVal(primaryRow, hMap, 'Billing Address2'),
        city: getVal(primaryRow, hMap, 'Billing City'),
        province: getVal(primaryRow, hMap, 'Billing Province Name') || getVal(primaryRow, hMap, 'Billing Province'),
        zip: (getVal(primaryRow, hMap, 'Billing Zip') || '').replace(/'/g, ''),
        country: getVal(primaryRow, hMap, 'Billing Country'),
        phone: normalizePhone(getVal(primaryRow, hMap, 'Billing Phone')) || phone,
      });

      // ─── Create/Update Address in Address Table ───
      const shAddress1 = getVal(primaryRow, hMap, 'Shipping Address1');
      const shCity = getVal(primaryRow, hMap, 'Shipping City');
      const shZip = (getVal(primaryRow, hMap, 'Shipping Zip') || '').replace(/'/g, '').trim();
      const shState = getVal(primaryRow, hMap, 'Shipping Province Name') || getVal(primaryRow, hMap, 'Shipping Province');
      const shCountry = getVal(primaryRow, hMap, 'Shipping Country') || 'India';
      const shName = shippingName || billingName;
      const shPhone = normalizePhone(getVal(primaryRow, hMap, 'Shipping Phone')) || phone;

      if (shAddress1 && shCity && shZip) {
        const key = addressKey(customer.id, shAddress1, shCity, shZip);
        if (!existingAddressesSet.has(key)) {
          const hasDefault = dbAddressesList.some(a => a.customerId === customer.id);

          const newAddress = await prisma.address.create({
            data: {
              customerId: customer.id,
              name: shName || null,
              phone: shPhone || null,
              email: email || null,
              address1: shAddress1,
              address2: getVal(primaryRow, hMap, 'Shipping Address2') || null,
              city: shCity,
              state: shState || 'Delhi',
              zip: shZip,
              country: shCountry,
              isDefault: !hasDefault,
            }
          });
          existingAddressesSet.add(key);
          dbAddressesList.push(newAddress);
        }
      }

      // ─── Build Line Items ───
      const lineItems = [];
      for (const row of rows) {
        const itemTitle = getVal(row, hMap, 'Lineitem name');
        if (!itemTitle) continue;
        
        const lineItemId = `csv_${orderName}_${lineItems.length}_${Date.now()}`;
        lineItems.push({
          shopifyLineItemId: lineItemId,
          title: itemTitle,
          quantity: parseInt2(getVal(row, hMap, 'Lineitem quantity')) || 1,
          price: parseFloat2(getVal(row, hMap, 'Lineitem price')),
          sku: getVal(row, hMap, 'Lineitem sku') || null,
        });
      }

      if (lineItems.length === 0) {
        skipped++;
        continue;
      }

      // ─── Determine statuses ───
      const orderStatus = mapFinancialToStatus(financialStatus, cancelledAt);
      const deliveryStatus = mapFulfillmentToDeliveryStatus(fulfillmentStatus, financialStatus, cancelledAt);

      // Parse created date
      let orderDate = new Date();
      if (createdAt) {
        const parsed = new Date(createdAt);
        if (!isNaN(parsed.getTime())) {
          orderDate = parsed;
        }
      }

      // Build note with extra info
      const orderNote = [
        notes,
        discountCode ? `Discount: ${discountCode} (-₹${discountAmount})` : '',
        shippingMethod ? `Shipping: ${shippingMethod}` : '',
        paymentMethod ? `Payment: ${paymentMethod}` : '',
      ].filter(Boolean).join(' | ');

      // ─── Check if it is a mobile order ───
      const isMobile = tags && (
        tags.toLowerCase().includes('mobile-app') ||
        tags.toLowerCase().includes('mobileapp') ||
        tags.toLowerCase().includes('apporder')
      );

      if (isMobile) {
        let mobileOrderNumber = null;
        if (tags) {
          const match = tags.match(/zb-order-([A-Za-z0-9-]+)/);
          if (match) {
            mobileOrderNumber = match[1];
          }
        }
        const mOrderNumber = mobileOrderNumber || shopifyOrderId.replace(/^#/, '');

        const existingMobileOrder = existingMobileOrders.get(mOrderNumber);

        if (!existingMobileOrder) {
          // Create mobile order items
          const mobileItems = [];
          for (const item of lineItems) {
            const skuLower = item.sku ? item.sku.toLowerCase() : '';
            const titleLower = item.title ? item.title.toLowerCase() : '';
            const productId = productSkuMap.get(skuLower) || productTitleMap.get(titleLower) || null;
            
            mobileItems.push({
              title: item.title,
              quantity: item.quantity,
              price: item.price,
              sku: item.sku,
              productId,
              variantId: null
            });
          }

          const createdMobileOrder = await prisma.mobileOrder.create({
            data: {
              orderNumber: mOrderNumber,
              shopifyOrderId: shopifyOrderId,
              customerId: customer.id,
              status: 'synced',
              paymentStatus: financialStatus || 'pending',
              paymentMethod: paymentMethod || null,
              totalPrice: totalPrice,
              subtotalPrice: subtotal || (totalPrice - taxes - shipping),
              totalTax: taxes,
              discountAmount: discountAmount || 0,
              discountCode: discountCode || null,
              currency: currency,
              fulfillmentStatus: fulfillmentStatus || 'unfulfilled',
              deliveryStatus: deliveryStatus,
              shippingAddress: shippingAddress,
              billingAddress: billingAddress,
              note: orderNote || null,
              tags: tags || null,
              source: 'mobile_app',
              createdAt: orderDate,
              syncedAt: new Date(),
              items: {
                create: mobileItems
              }
            }
          });
          existingMobileOrders.set(mOrderNumber, createdMobileOrder);
          console.log(`   ✓ Populated MobileOrder: ${mOrderNumber} (linked to ${shopifyOrderId})`);
        } else {
          // Update shopifyOrderId if empty
          if (!existingMobileOrder.shopifyOrderId) {
            await prisma.mobileOrder.update({
              where: { id: existingMobileOrder.id },
              data: {
                shopifyOrderId: shopifyOrderId,
                status: 'synced',
                syncedAt: new Date()
              }
            });
            existingMobileOrder.shopifyOrderId = shopifyOrderId;
            existingMobileOrder.status = 'synced';
          }
        }
      }

      // ─── Create/Update Order in Order Table ───
      const orderExists = existingShopifyOrders.has(shopifyOrderId);

      if (!orderExists) {
        // Resolve product IDs for the items if possible
        const orderLineItems = [];
        for (const item of lineItems) {
          const skuLower = item.sku ? item.sku.toLowerCase() : '';
          const titleLower = item.title ? item.title.toLowerCase() : '';
          const productId = productSkuMap.get(skuLower) || productTitleMap.get(titleLower) || null;
          
          orderLineItems.push({
            shopifyLineItemId: item.shopifyLineItemId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            sku: item.sku,
            productId
          });
        }

        const createdOrder = await prisma.order.create({
          data: {
            shopId: shop.id,
            shopifyOrderId,
            customerId: customer.id,
            status: orderStatus,
            totalPrice,
            subtotalPrice: subtotal || (totalPrice - taxes - shipping),
            totalTax: taxes,
            currency,
            paymentStatus: financialStatus || 'pending',
            fulfillmentStatus: fulfillmentStatus || 'unfulfilled',
            deliveryStatus,
            shippingAddress,
            billingAddress,
            note: orderNote || null,
            tags: tags || null,
            createdAt: orderDate,
            items: {
              create: orderLineItems
            },
            ...(paymentMethod ? {
              payments: {
                create: {
                  customerId: customer.id,
                  amount: totalPrice,
                  type: financialStatus === 'paid' ? 'PAYMENT' : 'COD',
                  status: financialStatus || 'pending',
                  gateway: paymentMethod,
                }
              }
            } : {}),
          },
          include: { items: true }
        });

        existingShopifyOrders.set(shopifyOrderId, createdOrder.id);

        // ─── Handle Returns for Refunded Orders ───
        if (financialStatus?.toLowerCase().includes('refunded')) {
          const firstItem = createdOrder.items[0];
          if (firstItem) {
            await prisma.return.create({
              data: {
                orderId: createdOrder.id,
                customerId: customer.id,
                productId: firstItem.productId || dbProducts[0]?.id || 'cmmpk2s1k000481uej9u1o3v7',
                reason: 'Refunded in Shopify',
                status: 'REFUNDED',
                refundMethod: 'ORIGINAL',
                refundAmount: totalPrice,
                refundStatus: 'COMPLETED',
                requestedAt: orderDate,
              }
            });
          }
        }

        // Update customer order count
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            ordersCount: { increment: 1 },
            totalSpent: { increment: totalPrice },
          }
        });

        imported++;
        if (imported % 50 === 0) {
          console.log(`  ✓ Imported ${imported} orders...`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      if (errors <= 10) {
        console.error(`  ✗ Error on ${orderName}:`, err.message);
      }
    }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭  Skipped (already exist): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('════════════════════════════════════════════════\n');

  // Print summary
  const totalOrders = await prisma.order.count();
  const totalCustomers = await prisma.customer.count();
  console.log(`📊 Database now has ${totalOrders} orders and ${totalCustomers} customers`);
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
