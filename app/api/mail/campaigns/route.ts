import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// GET: Retrieve all sent campaigns
export async function GET(request: NextRequest) {
  try {
    const campaigns = await prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, campaigns }, { status: 200 });
  } catch (error: any) {
    console.error('[Campaigns GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST: Save and dispatch a new marketing campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subject, html, recipients } = body;

    if (!name || !subject || !html || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields. Name, subject, html, and non-empty recipients array are required.' },
        { status: 400 }
      );
    }

    // 1. Create campaign draft/sent log in database
    const campaign = await prisma.emailCampaign.create({
      data: {
        name,
        subject,
        htmlContent: html,
        targetSegment: `custom-list-${recipients.length}`,
        status: 'sending',
        createdBy: 'admin',
      },
    });

    let sent = 0;
    let failed = 0;

    // 2. Dispatch emails individually in background or synchronously (non-blocking for UI)
    // We'll run the send loop asynchronously to return response immediately
    const dispatchPromises = recipients.map(async (recipientEmail: string) => {
      try {
        await sendEmail({
          to: recipientEmail,
          subject,
          html,
        });
        sent++;
      } catch (err) {
        console.error(`[Campaign Dispatch] Failed to send email to ${recipientEmail}:`, err);
        failed++;
      }
    });

    // We wait for all dispatches to complete, then update the campaign stats
    Promise.all(dispatchPromises)
      .then(async () => {
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            statsSent: sent,
            statsBounced: failed,
          },
        });
        console.log(`[Campaign ${campaign.id}] Dispatch completed. Sent: ${sent}, Failed: ${failed}`);
      })
      .catch((err) => {
        console.error(`[Campaign ${campaign.id}] Serious error in dispatch thread:`, err);
      });

    return NextResponse.json(
      {
        success: true,
        message: 'Campaign scheduled and dispatch started successfully.',
        campaignId: campaign.id,
        recipientCount: recipients.length,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Campaigns POST Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch marketing campaign' },
      { status: 500 }
    );
  }
}
