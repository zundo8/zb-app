import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

async function main() {
  if (!dbUrl) return;
  const pool = new Pool({ connectionString: dbUrl.replace('sslmode=require', 'sslmode=no-verify'), ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  console.log('🧹 Clearing all permissions to allow enum update...');
  await prisma.permission.deleteMany({});
  console.log('✅ Permissions cleared.');

  await prisma.$disconnect();
  await pool.end();
}

main();
