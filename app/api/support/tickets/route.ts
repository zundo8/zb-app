import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { resolvePrincipal } from '@/lib/ai/principal';

import { processSupportTicketAIReply } from '@/lib/ai/supportAgent';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const principal = await resolvePrincipal(req);
    const body = await req.json();
    const { ticketId, status, priority, aiAutoReply } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Security check: Admins can update any ticket; customers can only update their own ticket status/priority
    if (principal.kind === 'customer' && ticket.customerId !== principal.customerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (principal.kind === 'guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(typeof aiAutoReply === 'boolean' && { aiAutoReply }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ticket: updatedTicket });
  } catch (error: any) {
    console.error('[Support API] PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const principal = await resolvePrincipal(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const ticketId = url.searchParams.get('ticketId');
    const requestedCustomerId = url.searchParams.get('customerId');
    const requestedGuestEmail = url.searchParams.get('guestEmail');

    const referer = req.headers.get('referer') || '';
    const isDashboard = referer.includes('/dashboard/') || req.nextUrl.pathname.startsWith('/api/admin/');

    const where: any = {};
    if (ticketId) where.id = ticketId;
    if (status) where.status = status;

    if (principal.kind === 'admin' || isDashboard) {
      if (requestedCustomerId) where.customerId = requestedCustomerId;
      if (requestedGuestEmail) where.guestEmail = requestedGuestEmail;
    } else if (principal.kind === 'customer') {
      // Return tickets matching customerId OR customer email
      if (principal.email) {
        where.OR = [
          { customerId: principal.customerId },
          { guestEmail: principal.email },
        ];
      } else {
        where.customerId = principal.customerId;
      }
    } else {
      // Guest requests: allow fetching if specific ticketId, customerId, or guestEmail requested
      if (ticketId) {
        where.id = ticketId;
      } else if (requestedCustomerId) {
        where.customerId = requestedCustomerId;
      } else if (requestedGuestEmail) {
        where.guestEmail = requestedGuestEmail;
      } else {
        return NextResponse.json({ tickets: [] });
      }
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ tickets });
  } catch (error: any) {
    console.error('[Support API] GET Tickets Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const principal = await resolvePrincipal(req);
    const body = await req.json();
    const { guestName, guestEmail, subject, content, priority } = body;

    // Determine target customerId from principal (never client-supplied parameter)
    const customerId = principal.kind === 'customer' ? principal.customerId : null;

    if (!subject || !content || (!customerId && (!guestName || !guestEmail))) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        customerId,
        guestName: customerId ? null : guestName,
        guestEmail: customerId ? null : guestEmail,
        subject,
        priority: priority || 'MEDIUM',
        messages: {
          create: [
            {
              content,
              senderType: 'USER',
              senderId: customerId,
              senderName: guestName || (principal.kind === 'customer' ? 'Customer' : 'Guest'),
            },
            // Instant templated acknowledgment
            {
              content: `Hello! We have received your support request regarding "${subject}". Our team and Zica AI assistant will review it shortly. Ticket ID: #${subject.slice(0, 4)}-${Date.now().toString().slice(-4)}`,
              senderType: 'ZICA_AI',
              senderId: 'system',
              senderName: 'Zica AI',
            }
          ],
        },
      },
      include: {
        messages: true,
      },
    });

    // Send email notification asynchronously (non-blocking)
    sendMail({
      to: process.env.ZOHO_MAIL_USER || 'support@zicabella.com',
      subject: `[SUPPORT] New Ticket: ${subject}`,
      html: `
        <h3>New Support Ticket Created</h3>
        <p><strong>From:</strong> ${guestName || customerId} (${guestEmail || 'Logged-in User'})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${content}</p>
        <hr />
        <p>View in Admin Dashboard: <a href="https://app.zicabella.com/dashboard/support/${ticket.id}">View Ticket</a></p>
      `,
    }).catch((mailError) => {
      console.error('[Support API] Failed to send notification email:', mailError);
    });

    // Trigger AI Auto-reply inline for the new ticket
    try {
      await processSupportTicketAIReply(ticket.id, content);
    } catch (aiErr) {
      console.error('[Support API] AI reply error on ticket creation:', aiErr);
    }

    // Refetch ticket with full updated messages including Zica AI reply
    const updatedTicket = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    return NextResponse.json({ ticket: updatedTicket || ticket });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
