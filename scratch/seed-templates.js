const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env.local)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function extractVariables(htmlBody) {
  if (!htmlBody) return [];
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set();
  let match;
  while ((match = regex.exec(htmlBody)) !== null) {
    variables.add(match[1].trim());
  }
  return Array.from(variables);
}

const dbUrl = process.env.DATABASE_URL || '';
const pgUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  dbUrl;

if (!pgUrl || pgUrl.includes('placeholder') || pgUrl === '') {
  console.error('[DB] Error: No database URL found in environment variables.');
  process.exit(1);
}

// Hardened PgAdapter setup replicating lib/db.ts
const sanitizedPgUrl = pgUrl.includes('sslmode=require') 
  ? pgUrl.replace('sslmode=require', 'sslmode=no-verify')
  : pgUrl;

// Allow self-signed certificates (Supabase database pooler patch)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: sanitizedPgUrl,
  ssl: { 
    rejectUnauthorized: false 
  },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding templates database directly via PrismaPg Adapter...');
  
  const templatesToSeed = [
    { file: 'welcome.html', name: 'Welcome', category: 'transactional', subject: 'Welcome to Zica Bella', trigger: 'WELCOME' },
    { file: 'order-confirmation.html', name: 'Order Confirmation', category: 'transactional', subject: 'Your order #{{orderId}} is confirmed', trigger: 'ORDER_CONFIRMATION' },
    { file: 'order-shipped.html', name: 'Order Shipped', category: 'transactional', subject: 'Your order is on its way', trigger: 'ORDER_SHIPPED' },
    { file: 'payment-failed.html', name: 'Payment Failed', category: 'transactional', subject: 'Action required — payment unsuccessful', trigger: 'PAYMENT_FAILED' },
    { file: 'order-cancelled.html', name: 'Order Cancelled', category: 'transactional', subject: 'Your order has been cancelled', trigger: 'ORDER_CANCELLED' },
    { file: 'order-delivered.html', name: 'Order Delivered', category: 'transactional', subject: 'Your order has arrived', trigger: 'ORDER_DELIVERED' },
    { file: 'return-refund.html', name: 'Return & Refund', category: 'transactional', subject: 'Your return has been accepted', trigger: 'RETURN_REFUND' },
    { file: 'new-drop.html', name: 'New Drop', category: 'marketing', subject: '{{collectionName}} — Members Only Drop', trigger: null },
    { file: 'password-reset.html', name: 'Password Reset', category: 'transactional', subject: 'Reset your Zica Bella password', trigger: 'PASSWORD_RESET' }
  ];

  try {
    // 1. Delete all existing templates
    console.log('Clearing existing email templates in database...');
    const deleteRes = await prisma.emailTemplate.deleteMany({});
    console.log(`Cleared ${deleteRes.count} templates.`);

    // 2. Insert new templates
    for (const t of templatesToSeed) {
      const filePath = path.join(process.cwd(), 'lib', 'email-templates', t.file);
      let htmlBody = '';
      if (fs.existsSync(filePath)) {
        htmlBody = fs.readFileSync(filePath, 'utf8');
      } else {
        console.warn(`Warning: Template file ${t.file} not found, seeding empty body.`);
      }
      
      const variables = extractVariables(htmlBody);

      console.log(`Seeding template: ${t.name} (Trigger: ${t.trigger || 'NONE'})`);
      await prisma.emailTemplate.create({
        data: {
          name: t.name,
          category: t.category,
          subject: t.subject,
          htmlBody,
          variables,
          isActive: true,
          createdBy: 'system',
          automationTrigger: t.trigger
        }
      });
    }
    console.log('All templates successfully seeded to the database.');
  } catch (error) {
    console.error('Error during database seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
