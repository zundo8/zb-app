import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import prisma from '@/lib/db';
import { getAppAuthFromRequest, resolveAuthCustomer } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  let customer = null;
  const auth = getAppAuthFromRequest(req);

  if (auth) {
    customer = await resolveAuthCustomer(auth);
  } else {
    const session = await getServerSession(authOptions);
    if (session && session.user) {
      const whereClause: any = { OR: [] };
      if (session.user.email) {
        whereClause.OR.push({ email: session.user.email });
      }
      const sessionUserId = (session.user as any).id;
      if (sessionUserId) {
        whereClause.OR.push({ id: sessionUserId });
      }
      if (whereClause.OR.length > 0) {
        customer = await prisma.customer.findFirst({
          where: whereClause
        });
      }
    }
  }

  if (!customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  try {
    const { returnRequestId } = await req.json();
    if (!returnRequestId) {
      return NextResponse.json({ error: 'returnRequestId required' }, { status: 400, headers: corsHeaders });
    }

    // Fetch the request (either ReturnRequest or ExchangeRequest)
    let returnRequest = await prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { returns: true },
    });

    let exchangeRequest = null;
    let isExchange = false;

    if (!returnRequest) {
      exchangeRequest = await prisma.exchangeRequest.findUnique({
        where: { id: returnRequestId },
        include: { exchanges: true },
      });
      if (exchangeRequest) {
        isExchange = true;
      }
    }

    if (!returnRequest && !exchangeRequest) {
      return NextResponse.json({ error: 'Return or exchange request not found' }, { status: 404, headers: corsHeaders });
    }

    const customerId = isExchange ? exchangeRequest!.customerId : returnRequest!.customerId;
    const status = isExchange ? exchangeRequest!.status : returnRequest!.status;
    const orderId = isExchange ? exchangeRequest!.orderId : returnRequest!.orderId;

    if (customerId !== customer.id) {
      return NextResponse.json({ error: 'Unauthorized: not your request' }, { status: 403, headers: corsHeaders });
    }

    // Only allow cancellation when the request is still pending approval
    if (status !== 'pending_approval') {
      return NextResponse.json({ error: `Cannot cancel a processed ${isExchange ? 'exchange' : 'return'} request` }, { status: 400, headers: corsHeaders });
    }

    let updated;
    if (isExchange) {
      updated = await prisma.exchangeRequest.update({
        where: { id: returnRequestId },
        data: { status: 'cancelled' },
      });

      await prisma.$transaction([
        prisma.exchange.updateMany({
          where: { exchangeRequestId: returnRequestId },
          data: { status: 'cancelled' },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { status: 'delivered' },
        }),
      ]);
    } else {
      updated = await prisma.returnRequest.update({
        where: { id: returnRequestId },
        data: { status: 'cancelled' },
      });

      await prisma.$transaction([
        prisma.return.updateMany({
          where: { returnRequestId },
          data: { status: 'cancelled' },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { status: 'delivered' },
        }),
      ]);
    }

    return NextResponse.json({ success: true, message: `${isExchange ? 'Exchange' : 'Return'} request cancelled`, updated }, { headers: corsHeaders });
  } catch (e: any) {
    console.error('[Cancel Return] Error:', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500, headers: corsHeaders });
  }
}
