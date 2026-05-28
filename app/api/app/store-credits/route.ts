import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest, resolveAuthCustomer } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/app/store-credits?customerId=...&phone=...&email=...
 *
 * Returns the customer's store credit balance and transaction history.
 */
export async function GET(req: Request) {
  try {
    const auth = getAppAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const resolvedCustomer = await resolveAuthCustomer(auth);
    if (!resolvedCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId')?.trim() || resolvedCustomer.id;
    
    // Security: Only allow users to view their own balance
    if (customerId !== resolvedCustomer.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, storeCredits: true, storeCreditPreference: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    const transactions = await prisma.storeCredit.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      {
        balance: customer.storeCredits,
        preferStoreCredits: customer.storeCreditPreference,
        transactions: transactions.map((t: any) => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          orderId: t.orderId,
          returnId: t.returnId,
          createdAt: t.createdAt,
        })),
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[App API] Store Credits GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

/**
 * POST /api/app/store-credits
 *
 * Body: { customerId, action: 'set_preference', preferStoreCredits: boolean }
 *   — Toggle the customer's preference for receiving refunds as store credits.
 *
 * Body: { customerId, action: 'apply', amount: number, orderId: string }
 *   — Debit store credits during checkout.
 */
export async function POST(req: Request) {
  try {
    const auth = getAppAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const resolvedCustomer = await resolveAuthCustomer(auth);
    if (!resolvedCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    const body = await req.json();
    const { customerId, action } = body;

    const targetCustomerId = customerId || resolvedCustomer.id;

    // Security: Users can only modify their own credits/preferences
    if (targetCustomerId !== resolvedCustomer.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: targetCustomerId },
      select: { id: true, storeCredits: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    if (action === 'set_preference') {
      const { preferStoreCredits } = body;
      await prisma.customer.update({
        where: { id: customer.id },
        data: { storeCreditPreference: !!preferStoreCredits },
      });
      return NextResponse.json(
        { success: true, preferStoreCredits: !!preferStoreCredits },
        { headers: corsHeaders }
      );
    }

    if (action === 'apply') {
      const { amount, orderId } = body;
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: 'Amount must be a positive number' },
          { status: 400, headers: corsHeaders }
        );
      }
      if (amount > customer.storeCredits) {
        return NextResponse.json(
          { error: 'Insufficient store credits', balance: customer.storeCredits },
          { status: 400, headers: corsHeaders }
        );
      }

      // Debit the credits and record the transaction
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: customer.id },
          data: { storeCredits: { decrement: amount } },
        }),
        prisma.storeCredit.create({
          data: {
            customerId: customer.id,
            amount: -amount, // Record as negative for debit
            type: 'DEBIT',
            description: `Applied to order ${orderId || 'checkout'}`,
            orderId: orderId || null,
          },
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          newBalance: customer.storeCredits - amount,
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[App API] Store Credits POST error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
