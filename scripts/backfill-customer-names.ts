import prisma from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { isValidName } from '../lib/utils/customerName';

function parseAddressName(addrRaw?: any): string | null {
  if (!addrRaw) return null;
  let parsed: any = addrRaw;
  if (typeof addrRaw === 'string') {
    try {
      parsed = JSON.parse(addrRaw);
    } catch {
      return null;
    }
  }
  if (parsed && typeof parsed === 'object') {
    const candidate = parsed.name || (parsed.first_name ? `${parsed.first_name} ${parsed.last_name || ''}`.trim() : null);
    if (isValidName(candidate)) {
      return candidate.trim();
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');

  console.log(`=== Customer Name Backfill Script ===`);
  console.log(`Mode: ${isApply ? 'APPLY (writing to database)' : 'DRY-RUN (pass --apply to execute changes)'}`);

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  });

  const candidates = customers.filter(c => !isValidName(c.name));
  console.log(`Total customers scanned: ${customers.length}`);
  console.log(`Customers needing name repair: ${candidates.length}`);

  const report: Array<{
    customerId: string;
    oldName: string | null;
    newName: string | null;
    status: 'recovered' | 'unrecoverable' | 'cleared_generic';
    source?: string;
    phone?: string | null;
    email?: string | null;
  }> = [];

  let recoveredCount = 0;
  let clearedCount = 0;
  let unrecoverableCount = 0;

  for (const cust of candidates) {
    const last10 = cust.phone ? cust.phone.replace(/\D/g, '').slice(-10) : '';
    let recoveredName: string | null = null;
    let recoveredSource: string | null = null;

    // 1. Check Address records for customer (most recent first)
    const addresses = await prisma.address.findMany({
      where: { customerId: cust.id },
      orderBy: { createdAt: 'desc' },
    });
    for (const addr of addresses) {
      if (isValidName(addr.name)) {
        recoveredName = addr.name.trim();
        recoveredSource = `Address (id: ${addr.id})`;
        break;
      }
    }

    // 2. Check Order shipping/billing address
    if (!recoveredName) {
      const orders = await prisma.order.findMany({
        where: { customerId: cust.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, shippingAddress: true, billingAddress: true },
      });
      for (const ord of orders) {
        const shipName = parseAddressName(ord.shippingAddress);
        if (shipName) {
          recoveredName = shipName;
          recoveredSource = `Order.shippingAddress (order: ${ord.id})`;
          break;
        }
        const billName = parseAddressName(ord.billingAddress);
        if (billName) {
          recoveredName = billName;
          recoveredSource = `Order.billingAddress (order: ${ord.id})`;
          break;
        }
      }
    }

    // 3. Check WebStoreOrder records by phone/email
    if (!recoveredName && (cust.email || last10.length === 10)) {
      const orConds: any[] = [];
      if (cust.email) orConds.push({ customerEmail: cust.email });
      if (last10.length === 10) orConds.push({ customerPhone: { contains: last10 } });

      const webOrders = await prisma.webStoreOrder.findMany({
        where: { OR: orConds },
        orderBy: { createdAt: 'desc' },
        select: { id: true, customerName: true, shippingAddress: true },
      });

      for (const wo of webOrders) {
        if (isValidName(wo.customerName)) {
          recoveredName = wo.customerName.trim();
          recoveredSource = `WebStoreOrder.customerName (id: ${wo.id})`;
          break;
        }
        const shipName = parseAddressName(wo.shippingAddress);
        if (shipName) {
          recoveredName = shipName;
          recoveredSource = `WebStoreOrder.shippingAddress (id: ${wo.id})`;
          break;
        }
      }
    }

    if (recoveredName) {
      recoveredCount++;
      report.push({
        customerId: cust.id,
        oldName: cust.name,
        newName: recoveredName,
        status: 'recovered',
        source: recoveredSource!,
        phone: cust.phone,
        email: cust.email,
      });

      if (isApply) {
        await prisma.customer.update({
          where: { id: cust.id },
          data: { name: recoveredName },
        });
      }
    } else {
      // If customer had a generic name like "Valued Customer", clear it to null
      if (cust.name !== null) {
        clearedCount++;
        report.push({
          customerId: cust.id,
          oldName: cust.name,
          newName: null,
          status: 'cleared_generic',
          source: 'none (cleared stored generic placeholder to null)',
          phone: cust.phone,
          email: cust.email,
        });

        if (isApply) {
          await prisma.customer.update({
            where: { id: cust.id },
            data: { name: null },
          });
        }
      } else {
        unrecoverableCount++;
        report.push({
          customerId: cust.id,
          oldName: null,
          newName: null,
          status: 'unrecoverable',
          source: 'none (no valid name found)',
          phone: cust.phone,
          email: cust.email,
        });
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Recovered real names: ${recoveredCount}`);
  console.log(`Cleared stored generic strings to null: ${clearedCount}`);
  console.log(`Unrecoverable (remaining null): ${unrecoverableCount}`);

  // Write audit report
  const outputDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const reportPath = path.join(outputDir, 'backfill_customer_names_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: isApply ? 'apply' : 'dry-run',
        totalScanned: customers.length,
        candidatesCount: candidates.length,
        recoveredCount,
        clearedCount,
        unrecoverableCount,
        details: report,
      },
      null,
      2
    )
  );

  console.log(`\nAudit report saved to: ${reportPath}`);
}

main()
  .catch(err => {
    console.error('Backfill script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
