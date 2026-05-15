import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, content, senderType, senderId, senderName } = body;

    if (!ticketId || !content || !senderType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const message = await prisma.supportMessage.create({
      data: {
        ticketId,
        content,
        senderType,
        senderId,
        senderName,
      },
    });

    // Update ticket's updatedAt timestamp
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    // If sender is AGENT, notify the user (if email available)
    if (senderType === 'AGENT') {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { messages: true },
      });

      if (ticket && (ticket.guestEmail || ticket.customerId)) {
        let recipientEmail = ticket.guestEmail;
        
        if (!recipientEmail && ticket.customerId) {
          const customer = await prisma.customer.findUnique({
            where: { id: ticket.customerId },
          });
          recipientEmail = customer?.email || null;
        }

        if (recipientEmail) {
          try {
            await sendMail({
              to: recipientEmail,
              subject: `Re: ${ticket.subject} [Support Ticket #${ticket.id.slice(-6)}]`,
              html: `
                <p>Hello,</p>
                <p>You have a new message from Zica Bella Support regarding your ticket "${ticket.subject}":</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Support Agent:</strong></p>
                  <p>${content}</p>
                </div>
                <p>You can reply to this email or visit our support page to continue the conversation.</p>
                <p>Thank you,</p>
                <p>Zica Bella Team</p>
              `,
            });
          } catch (mailError) {
            console.error('[Support API] Failed to send user notification:', mailError);
          }
        }
      }
    }

    return NextResponse.json({ message }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
