import prisma from './db';

export async function allocateFailedOrderNumber(): Promise<string> {
  // Count existing ZBPF orders to determine the next number
  // We look for both with and without the '#' prefix
  const count = await prisma.order.count({
    where: {
      OR: [
        { shopifyOrderId: { startsWith: 'ZBPF' } },
        { shopifyOrderId: { startsWith: '#ZBPF' } }
      ]
    }
  });

  const nextNumber = count + 1;
  
  // Try to find a unique candidate starting from nextNumber
  for (let i = 0; i < 500; i++) {
    const num = nextNumber + i;
    const formattedNum = num.toString().padStart(2, '0');
    const candidate = `ZBPF${formattedNum}`;
    
    const existing = await prisma.order.findFirst({
      where: {
        OR: [
          { shopifyOrderId: candidate },
          { shopifyOrderId: `#${candidate}` }
        ]
      }
    });
    
    if (!existing) return candidate;
  }

  // Fallback to timestamp if somehow we can't find a gap
  return `ZBPF${Date.now().toString().slice(-6)}`;
}
