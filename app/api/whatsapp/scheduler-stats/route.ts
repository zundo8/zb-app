import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch the last scheduler run details
    const lastRun = await prisma.whatsAppSchedulerRun.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch the counts of sends in the last 24h per template
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messageStats = await prisma.whatsAppMessage.groupBy({
      by: ['templateName'],
      where: {
        direction: 'outbound',
        createdAt: { gte: twentyFourHoursAgo },
        templateName: { not: null }
      },
      _count: {
        id: true
      }
    });

    // Format template stats as a clean key-value object
    const templateCounts: Record<string, number> = {};
    messageStats.forEach((stat: any) => {
      if (stat.templateName) {
        templateCounts[stat.templateName] = stat._count.id;
      }
    });

    return NextResponse.json({
      success: true,
      lastRun: lastRun ? {
        id: lastRun.id,
        createdAt: lastRun.createdAt,
        campaignsProcessed: lastRun.campaignsProcessed,
        campaignRecipientsRetried: lastRun.campaignRecipientsRetried,
        messagesRetried: lastRun.messagesRetried,
        abandonedCartStep1Sent: lastRun.abandonedCartStep1Sent,
        abandonedCartStep2Sent: lastRun.abandonedCartStep2Sent,
        abandonedCartStep3Sent: lastRun.abandonedCartStep3Sent,
        errorCount: lastRun.errorCount,
        errors: lastRun.errors,
        success: lastRun.success
      } : null,
      sends24h: templateCounts
    });
  } catch (error: any) {
    console.error('[WhatsApp Scheduler Stats API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
