import prisma from '../lib/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const shop = await prisma.shop.findFirst();
  console.log('Shop Settings:', JSON.stringify(shop, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    // Note: prisma in lib/db.ts might not have $disconnect if it's the proxy
    if (typeof (prisma as any).$disconnect === 'function') {
      await (prisma as any).$disconnect();
    }
  });
