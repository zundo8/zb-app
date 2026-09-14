/**
 * One-off migration script to encrypt existing plaintext access tokens in the Shop table.
 * 
 * Usage:
 *   SECRET_ENCRYPTION_KEY=<base64-key> npx tsx scripts/encrypt-existing-tokens.ts
 * 
 * This script reads each Shop row, checks if accessToken is already encrypted,
 * and encrypts it if not. Safe to run multiple times (idempotent).
 */

import { PrismaClient } from '@prisma/client';
import { encryptSecret, isEncrypted } from '../lib/crypto/secret-box';

async function main() {
  if (!process.env.SECRET_ENCRYPTION_KEY) {
    console.error('ERROR: SECRET_ENCRYPTION_KEY env var is required.');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const shops = await prisma.shop.findMany({
      select: { id: true, accessToken: true },
    });

    console.log(`Found ${shops.length} shop(s) to check.`);

    let encrypted = 0;
    let skipped = 0;

    for (const shop of shops) {
      if (!shop.accessToken) {
        console.log(`  Shop ${shop.id}: no accessToken, skipping.`);
        skipped++;
        continue;
      }

      if (isEncrypted(shop.accessToken)) {
        console.log(`  Shop ${shop.id}: already encrypted, skipping.`);
        skipped++;
        continue;
      }

      const ciphertext = encryptSecret(shop.accessToken);
      await prisma.shop.update({
        where: { id: shop.id },
        data: { accessToken: ciphertext },
      });

      console.log(`  Shop ${shop.id}: encrypted ✓`);
      encrypted++;
    }

    console.log(`\nDone. Encrypted: ${encrypted}, Skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
