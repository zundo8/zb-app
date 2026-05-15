import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, status, priority } = body;

    console.log('[Support API] PATCH Request:', { ticketId, status, priority });

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400, headers: corsHeaders });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ticket }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Support API] PATCH Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get('customerId');
    const status = url.searchParams.get('status');
    const ticketId = url.searchParams.get('ticketId');

    const where: any = {};
    if (ticketId) where.id = ticketId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ tickets }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customerId, guestName, guestEmail, subject, content, priority } = body;

    if (!subject || !content || (!customerId && (!guestName || !guestEmail))) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        customerId,
        guestName,
        guestEmail,
        subject,
        priority: priority || 'MEDIUM',
        messages: {
          create: {
            content,
            senderType: 'USER',
            senderId: customerId,
            senderName: guestName || 'Customer',
          },
        },
      },
      include: {
        messages: true,
      },
    });

    // Send email notification to Zoho support mail
    try {
      await sendMail({
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
      });
    } catch (mailError) {
      console.error('[Support API] Failed to send notification email:', mailError);
    }

    return NextResponse.json({ ticket }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
