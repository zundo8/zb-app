import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const shop = await prisma.shop.findFirst();
  console.log(shop);
}
main();
