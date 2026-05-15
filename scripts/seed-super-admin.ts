import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcryptjs';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

// SSL Patch
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dbUrl = process.env.POSTGRES_PRISMA_URL || 
              process.env.POSTGRES_URL || 
              process.env.DATABASE_URL;

async function main() {
  if (!dbUrl) {
    console.error('❌ Error: No database URL found in environment variables');
    process.exit(1);
  }

  const sanitizedPgUrl = dbUrl.includes('sslmode=require') 
    ? dbUrl.replace('sslmode=require', 'sslmode=no-verify')
    : dbUrl;

  console.log(`📡 Database URL detected: ${sanitizedPgUrl.substring(0, 15)}...`);

  let prisma: PrismaClient;
  let pool: Pool | undefined;

  try {
    pool = new Pool({ 
      connectionString: sanitizedPgUrl,
      ssl: { rejectUnauthorized: false }
    });
    const adapter = new PrismaPg(pool as any);
    prisma = new PrismaClient({ adapter });

    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@zicabella.com';
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!password) {
      console.error('❌ Error: SUPER_ADMIN_PASSWORD is not set in environment variables');
      process.exit(1);
    }

    console.log(`🚀 Processing Super Admin: ${email}...`);

    const hashedPassword = await bcrypt.hash(password, 12);

    const superAdmin = await prisma.user.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        needsPasswordChange: false, // User explicitly specified these credentials
      },
      create: {
        email: email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        needsPasswordChange: false,
      }
    });

    console.log(`✅ Super Admin ${superAdmin.email} processed (Updated/Created).`);

    // Grant all permissions
    const modules = [
      'DASHBOARD_HOME', 'ORDERS', 'PRODUCTS', 'INVENTORY', 'CUSTOMERS',
      'MANUFACTURING', 'PRODUCTION_TRACKER', 'FINANCIAL', 'COST_LEDGER',
      'MARKETING', 'VENDORS', 'RETURNS', 'ANALYTICS', 'SETTINGS',
      'ADMIN_USERS', 'AUDIT_LOG'
    ];

    console.log('🚀 Granting full permissions...');

    for (const moduleName of modules) {
      await prisma.permission.upsert({
        where: {
          userId_module: {
            userId: superAdmin.id,
            module: moduleName as any,
          }
        },
        update: {
          canView: true,
          canEdit: true,
          canDelete: true,
        },
        create: {
          userId: superAdmin.id,
          module: moduleName as any,
          canView: true,
          canEdit: true,
          canDelete: true,
        }
      });
    }

    console.log('✅ Full permissions granted.');
    
    // Also update legacy Admin table if it exists to avoid confusion
    try {
      const legacyAdmin = await (prisma as any).admin.findUnique({
        where: { username: 'admin' }
      });
      if (legacyAdmin) {
        console.log('🔄 Updating legacy Admin table for consistency...');
        await (prisma as any).admin.update({
          where: { username: 'admin' },
          data: { password: hashedPassword } // Using same hash for both
        });
        console.log('✅ Legacy Admin table updated.');
      }
    } catch (e) {
      console.log('ℹ Legacy Admin table update skipped (may not exist or different schema).');
    }

  } catch (err) {
    console.error('❌ Failed:', err);
    throw err;
  } finally {
    // @ts-ignore
    if (prisma) await prisma.$disconnect();
    if (pool) await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
