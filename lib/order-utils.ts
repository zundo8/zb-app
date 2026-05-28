import prisma from './db';

export async function allocateOrderNumber(): Promise<string> {
  // Fetch the 100 most recent orders to find the highest ZB sequence number in use
  const recentOrders = await prisma.order.findMany({
    select: { shopifyOrderId: true, tags: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  let maxSeq = 0;
  for (const o of recentOrders) {
    const so = String(o.shopifyOrderId || '');
    const m1 = so.match(/#?ZB-?(\d+)/i);
    if (m1?.[1]) {
      const val = parseInt(m1[1], 10);
      if (val > maxSeq) maxSeq = val;
    }
    const tags = String(o.tags || '');
    const m2 = tags.match(/zb-order-ZB-?(\d+)/i);
    if (m2?.[1]) {
      const val = parseInt(m2[1], 10);
      if (val > maxSeq) maxSeq = val;
    }
  }

  // Base fallback if no sequence exists: start from ZB800000 + count
  const count = await prisma.order.count();
  const nextSeq = maxSeq > 0 ? maxSeq + 1 : (count > 0 ? 800000 + count + 1 : 800001);

  // Return formatted order number in ZB000001 format (exactly 6 digits padding)
  const candidate = `ZB${String(nextSeq).padStart(6, '0')}`;

  // Quick double-check to avoid collisions
  const existing = await prisma.order.findFirst({
    where: {
      OR: [
        { shopifyOrderId: `#${candidate}` },
        { shopifyOrderId: candidate },
        { tags: { contains: candidate } }
      ]
    },
    select: { id: true }
  });

  if (!existing) return candidate;

  // Collision fallback
  return `ZB${String(nextSeq + Math.floor(Math.random() * 100) + 1).padStart(6, '0')}`;
}

export async function allocateFailedOrderNumber(): Promise<string> {
  // Redirect to universal order numbering to ensure a single, consistent sequence
  return allocateOrderNumber();
}

