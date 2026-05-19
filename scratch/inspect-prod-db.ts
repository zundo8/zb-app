import * as dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function main() {
  console.log('Connecting to database...');
  console.log('Using POSTGRES_PRISMA_URL:', process.env.POSTGRES_PRISMA_URL ? 'FOUND' : 'NOT FOUND');
  
  // Dynamically import prisma so env vars are already loaded
  const { default: prisma } = await import('../lib/db');
  
  const users = await prisma.featuredUser.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${users.length} featured users:`);
  for (const u of users) {
    const isBase64 = u.imageUrl.startsWith('data:');
    const sizeKb = Math.round(u.imageUrl.length / 1024);
    console.log(`- ID: ${u.id} | Name: ${u.name} | Status: ${u.status} | Base64: ${isBase64} | Image Size: ${sizeKb} KB | URL prefix: ${u.imageUrl.substring(0, 50)}...`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
});
