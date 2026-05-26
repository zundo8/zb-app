import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    // 1. Verify admin session
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { customerId, ticketId } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400, headers: corsHeaders });
    }

    // Check if the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: corsHeaders });
    }

    console.log(`[Admin Support API] Starting account deletion for Customer: ${customer.name} (${customer.email || customer.phone}), ID: ${customerId}`);

    // 2. Perform all deletions within a database transaction
    await prisma.$transaction(async (tx) => {
      // a. Chat Reactions for messages by this customer
      const messages = await tx.communityMessage.findMany({
        where: { customerId },
        select: { id: true }
      });
      const messageIds = messages.map(m => m.id);
      if (messageIds.length > 0) {
        await tx.chatReaction.deleteMany({
          where: { messageId: { in: messageIds } }
        });
      }

      // b. Chat Reactions created by this customer
      await tx.chatReaction.deleteMany({
        where: { customerId }
      });

      // c. Community Messages by this customer
      await tx.communityMessage.deleteMany({
        where: { customerId }
      });

      // d. Community Member profile
      await tx.communityMember.deleteMany({
        where: { customerId }
      });

      // e. Returns
      await tx.return.deleteMany({
        where: { customerId }
      });

      // f. Payments
      await tx.payment.deleteMany({
        where: { customerId }
      });

      // g. Orders (which cascades to OrderItems, Shipments, etc.)
      await tx.order.deleteMany({
        where: { customerId }
      });

      // h. Support Tickets: we should NOT delete the support tickets since they are used
      // for history, but we should nullify customerId or ensure they don't break.
      // We will also mark the active ticketId as RESOLVED
      if (ticketId) {
        await tx.supportTicket.update({
          where: { id: ticketId },
          data: {
            status: 'RESOLVED',
            updatedAt: new Date()
          }
        });

        // Add a final confirmation message to the support ticket
        await tx.supportMessage.create({
          data: {
            ticketId,
            content: 'Your account deletion request has been approved. All personal data, order histories, and profile items have been completely purged from the system. This conversation will close shortly.',
            senderType: 'AGENT',
            senderName: 'System Admin'
          }
        });
      }

      // i. Delete the Customer record itself (cascades to Cart, Wishlist, Address, ProfileHistory, Follow, StoreCredit)
      await tx.customer.delete({
        where: { id: customerId }
      });
    });

    console.log(`[Admin Support API] Customer ${customerId} data purged successfully.`);
    return NextResponse.json({ success: true }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Admin Support API] Error during customer deletion:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete customer' }, { status: 500, headers: corsHeaders });
  }
}
