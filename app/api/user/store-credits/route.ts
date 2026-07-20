import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { voidExpiredCredits } from '@/lib/storeCreditsHelper';

export const dynamic = 'force-dynamic';

function getCleanPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : null;
}

function getCleanEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = String(email).trim().toLowerCase();
  return trimmed.length > 3 && trimmed.includes('@') ? trimmed : null;
}

/**
 * GET /api/user/store-credits
 *
 * Query params: ?email=...&phone=...
 *
 * Resolves customer by session or email/phone, voids expired credits,
 * and returns available store credit balance.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email || null;

    const url = new URL(req.url);
    const queryEmail = getCleanEmail(url.searchParams.get('email') || sessionEmail);
    const queryPhone = getCleanPhone(url.searchParams.get('phone'));

    if (!queryEmail && !queryPhone) {
      return NextResponse.json({
        success: true,
        balance: 0,
        storeCreditPreference: false,
      }, { status: 200 });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          ...(queryEmail ? [{ email: { equals: queryEmail, mode: 'insensitive' as const } }] : []),
          ...(queryPhone ? [{ phone: { contains: queryPhone } }] : []),
        ],
      },
      select: {
        id: true,
        storeCredits: true,
        storeCreditPreference: true,
        email: true,
        phone: true,
      },
    });

    if (!customer) {
      return NextResponse.json({
        success: true,
        balance: 0,
        storeCreditPreference: false,
      }, { status: 200 });
    }

    // Run expiration cleanup
    await voidExpiredCredits(customer.id);

    // Re-query updated store credit balance
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { storeCredits: true, storeCreditPreference: true },
    });

    const balance = Math.max(0, updatedCustomer?.storeCredits || 0);

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      balance,
      storeCreditPreference: updatedCustomer?.storeCreditPreference || false,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[WebStore Store Credit API] Error fetching store credits:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      balance: 0,
    }, { status: 500 });
  }
}
