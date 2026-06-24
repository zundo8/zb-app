import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

// Load production env
dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });

const dbUrl = process.env.DATABASE_URL;

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
  console.log('FailedLoginAttempts:', user?.failedLoginAttempts);
  console.log('LockUntil:', user?.lockUntil);
  console.log('Permissions Count:', user?.permissions.length);
  console.log('PasswordHash:', user?.passwordHash);

  if (user) {
    const testPasswords = ['ZBdrip@6699', 'ChooseAStrongPassword123!'];
    for (const pw of testPasswords) {
      const match = await bcrypt.compare(pw, user.passwordHash);
      console.log(`Password matching '${pw}':`, match);
    }
  } else {
    console.log('❌ User not found in database!');
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main();
