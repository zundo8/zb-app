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
  if (!dbUrl) {
    console.error('❌ No DB URL');
    return;
  }
  const pool = new Pool({ connectionString: dbUrl.replace('sslmode=require', 'sslmode=no-verify'), ssl: { rejectUnauthorized: false } });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  const email = 'admin@zicabella.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: { permissions: true }
  });

  console.log('--- USER DEBUG ---');
  console.log('Email:', user?.email);
  console.log('Role:', user?.role);
  console.log('IsActive:', user?.isActive);
  console.log('NeedsPasswordChange:', user?.needsPasswordChange);
  console.log('Permissions Count:', user?.permissions.length);
  console.log('PasswordHash StartsWith:', user?.passwordHash.substring(0, 10));
  
  await prisma.$disconnect();
  await pool.end();
}

main();
