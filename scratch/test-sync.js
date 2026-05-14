
const { fetchAllOrders } = require('./lib/shopify-admin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSync() {
  try {
    console.log('Testing Shopify connection...');
    const orders = await fetchAllOrders(5);
    console.log(`Found ${orders.length} orders.`);
    if (orders.length > 0) {
      console.log('First order ID:', orders[0].id);
    }
    
    const shop = await prisma.shop.findFirst();
    console.log('Database Shop:', shop ? shop.domain : 'None');
    
  } catch (e) {
    console.error('Test failed:', e.message);
  }
}

testSync();
