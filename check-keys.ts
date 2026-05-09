import prisma from './lib/db';

async function main() {
  const shop = await prisma.shop.findFirst();
  console.log('Shop Config:', {
    razorpayKeyId: shop?.razorpayKeyId,
    // mask secret
    hasSecret: !!shop?.razorpayKeySecret,
  });
}

main();
