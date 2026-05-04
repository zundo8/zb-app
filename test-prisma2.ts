import prisma from './lib/db';
async function main() {
  const shop = await prisma.shop.findFirst();
  console.log(Object.keys(shop || {}));
}
main();
