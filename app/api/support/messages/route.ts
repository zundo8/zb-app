import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { resolvePrincipal } from '@/lib/ai/principal';
import { processSupportTicketAIReply } from '@/lib/ai/supportAgent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const principal = await resolvePrincipal(req);
    const body = await req.json();
    const { ticketId, content } = body;

    if (!ticketId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Determine senderType securely based on principal or dashboard referer
    const referer = req.headers.get('referer') || '';
    const isDashboard = referer.includes('/dashboard/') || req.nextUrl.pathname.startsWith('/api/admin/');

    let senderType = 'USER';
    let senderId: string | null = null;
    let senderName = body.senderName || 'Customer';

    if (principal.kind === 'admin' || isDashboard) {
      senderType = 'AGENT';
      senderId = principal.kind === 'admin' ? principal.adminId : 'admin';
      senderName = body.senderName || 'Zica Support';
    } else if (principal.kind === 'customer') {
      if (ticket.customerId && ticket.customerId !== principal.customerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      senderType = 'USER';
      senderId = principal.customerId;
      senderName = body.senderName || 'Customer';
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
      if (ticket.guestEmail || ticket.customerId) {
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

    // Trigger email & AI Auto-reply if sender is USER
    let aiReplyResult = null;
    if (senderType === 'USER') {
      // Async email notification (fire-and-forget, non-blocking)
      const supportEmail = process.env.ZOHO_MAIL_USER || 'support@zicabella.com';
      sendMail({
        to: supportEmail,
        subject: `[SUPPORT MESSAGE] Ticket #${ticket.id.slice(-6).toUpperCase()}: ${ticket.subject}`,
        html: `
          <h3>New Customer Message Received</h3>
          <p><strong>Ticket ID:</strong> #${ticket.id}</p>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Customer Message:</strong></p>
            <p>${content}</p>
          </div>
          <hr />
          <p><a href="https://app.zicabella.com/dashboard/support/${ticket.id}">View and Reply in Admin Dashboard</a></p>
        `,
      }).catch((mailError) => {
        console.error('[Support API] Failed to send admin notification email:', mailError);
      });

      // Await Zica AI reply inline so response is immediately saved
      try {
        aiReplyResult = await processSupportTicketAIReply(ticketId, content);
      } catch (aiErr) {
        console.error('[Support API] AI reply error:', aiErr);
      }
    }

    return NextResponse.json({ message, aiReply: aiReplyResult });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}
