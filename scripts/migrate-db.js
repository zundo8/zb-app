/**
 * Database Migration Script
 * Migrates data from the old Supabase database to the new Supabase database.
 * 
 * Usage: node scripts/migrate-db.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const oldDbUrl = process.env.SOURCE_DATABASE_URL;
const newDbUrl = process.env.DEST_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!oldDbUrl || !newDbUrl) {
  console.error("❌ Error: SOURCE_DATABASE_URL and DEST_DATABASE_URL (or DIRECT_URL / DATABASE_URL) must be set.");
  process.exit(1);
}

const sourcePool = new Pool({
  connectionString: oldDbUrl,
  ssl: { rejectUnauthorized: false },
});

const destPool = new Pool({
  connectionString: newDbUrl,
  ssl: { rejectUnauthorized: false },
});

// Dependency order of tables for insertion
const tables = [
  'Shop',
  'Admin',
  'User',
  'Permission',
  'AuditLog',
  'BlogPost',
  'FeaturedUser',
  'Review',
  'ScanRecord',
  'MfgFabric',
  'MfgVendor',
  'MfgAuditLog',
  'ZicaAiGlobalInsight',
  'ZicaUserProfile',
  'WhatsAppCampaign',
  'EmailCampaign',
  'SmsCampaign',
  'WebhookEvent',
  'AIChatSession',
  'AIChatMessage',
  'ZicaAiCache',
  'WhatsAppMessage',
  'DeviceToken',
  'Customer',
  'CommunityMember',
  'CommunityUpdate',
  'CommunityMessage',
  'ChatReaction',
  'Address',
  'StoreCredit',
  'Cart',
  'CartItem',
  'ProfileHistory',
  'Follow',
  'Product',
  'Inventory',
  'Order',
  'OrderItem',
  'Payment',
  'Shipment',
  'ReturnRequest',
  'Return',
  'ExchangeRequest',
  'Exchange',
  'MfgProductionBatch',
  'MfgFabricMovement',
  'MfgTask',
  'MfgProductionStageLog',
  'MfgMiscExpense',
  'MfgBatchNote',
  'MobileOrder',
  'MobileOrderItem',
  'Discount',
  'VerificationCode',
  'AppLogin',
  'Policy',
  'EmailLog',
  'EmailTemplate',
  'EmailNotificationPreference',
  'EmailDraft',
  'Wishlist',
  'SupportTicket',
  'SupportMessage',
  'AdminNotificationRead',
  'CampaignAnalyticsEvent'
];

async function migrateTable(tableName) {
  console.log(`\n⏳ Migrating table: "${tableName}"...`);

  // 1. Fetch data from source
  let rows;
  try {
    const res = await sourcePool.query(`SELECT * FROM "${tableName}";`);
    rows = res.rows;
    console.log(`   Fetched ${rows.length} rows from source.`);
  } catch (err) {
    if (err.message.includes('relation') && err.message.includes('does not exist')) {
      console.log(`   ⚠️ Table "${tableName}" does not exist in source database. Skipping.`);
      return;
    }
    throw err;
  }

  if (rows.length === 0) {
    console.log(`   No data to migrate.`);
    return;
  }

  // 2. Truncate destination table (recursively if needed, but we do it in dependency order)
  try {
    await destPool.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
    console.log(`   Truncated destination table.`);
  } catch (err) {
    console.warn(`   ⚠️ Warning truncating "${tableName}": ${err.message}`);
  }

  // Get columns from the first row
  const columns = Object.keys(rows[0]);
  const colNames = columns.map(c => `"${c}"`).join(', ');

  // Batch inserts to avoid payload limits
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    // Construct parameterized query for batch
    const valuePlaceholders = [];
    const flatValues = [];
    let valCounter = 1;

    for (const row of batch) {
      const placeholders = [];
      for (const col of columns) {
        placeholders.push(`$${valCounter++}`);
        let val = row[col];
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          const isPgArray = 
            (tableName === 'ZicaUserProfile' && ['preferredCategories', 'preferredSizes', 'styleTags', 'favouriteProducts'].includes(col)) ||
            (tableName === 'ZicaAiCache' && ['detectedProducts', 'detectedCollections', 'intentTags'].includes(col)) ||
            (tableName === 'ZicaAiGlobalInsight' && ['sampleQueries'].includes(col));
          
          if (!isPgArray) {
            val = JSON.stringify(val);
          }
        }
        flatValues.push(val);
      }
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
    }

    const query = `INSERT INTO "${tableName}" (${colNames}) VALUES ${valuePlaceholders.join(', ')};`;

    try {
      await destPool.query(query, flatValues);
    } catch (err) {
      console.error(`   ❌ Error inserting batch in "${tableName}" (index ${i}-${i + batch.length}):`, err.message);
      console.error(`   Query: ${query.substring(0, 300)}...`);
      throw err;
    }
  }

  console.log(`   Successfully migrated ${rows.length} rows.`);
}

async function main() {
  console.log('🏁 Starting Database Migration...');
  console.log(`   Source: ${oldDbUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   Destination: ${newDbUrl.replace(/:[^:@]+@/, ':***@')}`);

  try {
    // Migrate in order
    for (const table of tables) {
      await migrateTable(table);
    }
    console.log('\n🎉 Migration completed successfully!');
  } catch (err) {
    console.error('\n💥 Migration failed:', err.message);
  } finally {
    await sourcePool.end();
    await destPool.end();
  }
}

main();
