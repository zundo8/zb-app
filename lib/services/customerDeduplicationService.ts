import prisma from '@/lib/db';

export interface DeduplicationSummary {
  mergedGroups: number;
  deletedCustomersCount: number;
}

async function mergeCustomerCluster(primary: any, duplicateIds: string[], duplicates: any[]) {
  if (duplicateIds.length === 0) return;

  // Relational merge transaction
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.address.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.payment.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.return.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.returnRequest.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.exchangeRequest.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.storeCredit.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.profileHistory.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.mobileOrder.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.communityMessage.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    }),
    prisma.wishlist.deleteMany({
      where: { customerId: { in: duplicateIds } },
    }),
    prisma.communityMember.deleteMany({
      where: { customerId: { in: duplicateIds } },
    }),
    prisma.cart.deleteMany({
      where: { customerId: { in: duplicateIds } },
    }),
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: { in: duplicateIds } },
          { followingId: { in: duplicateIds } },
        ],
      },
    }),
  ]);

  // Recalculate total orders and spent across merged records
  const allOrders = await prisma.order.findMany({
    where: { customerId: primary.id },
    select: { totalPrice: true },
  });

  const totalSpent = allOrders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
  const ordersCount = allOrders.length;

  // Best name, email, phone from duplicates
  const bestName = primary.name && primary.name !== 'Valued Customer' && primary.name !== 'Guest User'
    ? primary.name
    : duplicates.find((d: any) => d.name && d.name !== 'Valued Customer' && d.name !== 'Guest User')?.name || primary.name;

  const bestEmail = primary.email || duplicates.find((d: any) => d.email)?.email || null;
  const bestPhone = primary.phone || duplicates.find((d: any) => d.phone)?.phone || null;

  await prisma.customer.update({
    where: { id: primary.id },
    data: {
      ordersCount,
      totalSpent,
      ...(bestName ? { name: bestName } : {}),
      ...(bestEmail ? { email: bestEmail } : {}),
      ...(bestPhone ? { phone: bestPhone } : {}),
    },
  });

  // Delete duplicate customer records safely
  for (const dupId of duplicateIds) {
    try {
      await prisma.customer.delete({ where: { id: dupId } });
    } catch (delErr: any) {
      console.warn(`[CustomerDeduplication] Notice on deleting customer row ${dupId}:`, delErr.message);
    }
  }
}

/**
 * Sweeps the entire database using SQL group lookups, connects all duplicate Customer records
 * (by email or 10-digit phone), merges all linked relations into a single primary record,
 * updates aggregated metrics, and deletes all redundant duplicate Customer rows.
 */
export async function mergeAllDuplicateCustomers(): Promise<DeduplicationSummary> {
  let totalGroups = 0;
  let totalDeleted = 0;

  try {
    for (let pass = 0; pass < 20; pass++) {
      // Find emails with count > 1
      const duplicateEmails: any[] = await prisma.$queryRawUnsafe(`
        SELECT lower(email) as email, COUNT(*)::int as count
        FROM "Customer"
        WHERE email IS NOT NULL AND trim(email) != ''
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
        LIMIT 100;
      `);

      // Find phones with count > 1
      const duplicatePhones: any[] = await prisma.$queryRawUnsafe(`
        SELECT RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) as phone_digits, COUNT(*)::int as count
        FROM "Customer"
        WHERE phone IS NOT NULL AND length(REGEXP_REPLACE(phone, '\\D', '', 'g')) >= 10
        GROUP BY RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10)
        HAVING COUNT(*) > 1
        LIMIT 100;
      `);

      if (duplicateEmails.length === 0 && duplicatePhones.length === 0) {
        console.log('[CustomerDeduplication] Zero duplicate email or phone clusters remaining!');
        break;
      }

      let deletedInPass = 0;

      // Process email groups
      for (const row of duplicateEmails) {
        const email = row.email;
        const customers = await prisma.customer.findMany({
          where: { email: { equals: email, mode: 'insensitive' } },
          include: { orders: { select: { id: true } } },
          orderBy: { createdAt: 'asc' },
        });

        if (customers.length <= 1) continue;

        customers.sort((a: any, b: any) => {
          const aHasRealShopify = a.shopifyId && !a.shopifyId.startsWith('temp_') && !a.shopifyId.startsWith('GUEST_');
          const bHasRealShopify = b.shopifyId && !b.shopifyId.startsWith('temp_') && !b.shopifyId.startsWith('GUEST_');
          if (aHasRealShopify && !bHasRealShopify) return -1;
          if (!aHasRealShopify && bHasRealShopify) return 1;
          if (a.orders.length !== b.orders.length) return b.orders.length - a.orders.length;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        const primary = customers[0];
        const duplicates = customers.slice(1);
        const dupIds = duplicates.map((d: any) => d.id);

        await mergeCustomerCluster(primary, dupIds, duplicates);
        deletedInPass += dupIds.length;
        totalGroups++;
      }

      // Process phone groups
      for (const row of duplicatePhones) {
        const phoneDigits = row.phone_digits;
        const customers = await prisma.customer.findMany({
          where: { phone: { contains: phoneDigits } },
          include: { orders: { select: { id: true } } },
          orderBy: { createdAt: 'asc' },
        });

        if (customers.length <= 1) continue;

        customers.sort((a: any, b: any) => {
          const aHasRealShopify = a.shopifyId && !a.shopifyId.startsWith('temp_') && !a.shopifyId.startsWith('GUEST_');
          const bHasRealShopify = b.shopifyId && !b.shopifyId.startsWith('temp_') && !b.shopifyId.startsWith('GUEST_');
          if (aHasRealShopify && !bHasRealShopify) return -1;
          if (!aHasRealShopify && bHasRealShopify) return 1;
          if (a.orders.length !== b.orders.length) return b.orders.length - a.orders.length;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        const primary = customers[0];
        const duplicates = customers.slice(1);
        const dupIds = duplicates.map((d: any) => d.id);

        await mergeCustomerCluster(primary, dupIds, duplicates);
        deletedInPass += dupIds.length;
        totalGroups++;
      }

      totalDeleted += deletedInPass;
      if (deletedInPass === 0) break;
    }
  } catch (err: any) {
    console.error('[CustomerDeduplication] Sweeper error:', err.message);
  }

  return { mergedGroups: totalGroups, deletedCustomersCount: totalDeleted };
}
