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
    messageStats.forEach((stat: { templateName: string | null; _count: { id: number } }) => {
      if (stat.templateName) {
        templateCounts[stat.templateName] = stat._count.id;
      }
    });

    // 3. Fetch recent failed whatsAppMessage log to surface in "Last Error Log" panel
    const lastFailedMessage = await prisma.whatsAppMessage.findFirst({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      select: {
        templateName: true,
        errorCode: true,
        errorMessage: true,
        orderId: true,
        createdAt: true
      }
    });

    interface SchedulerRunSummary {
      id: string;
      createdAt: Date;
      campaignsProcessed: number;
      campaignRecipientsRetried: number;
      messagesRetried: number;
      abandonedCartStep1Sent: number;
      abandonedCartStep2Sent: number;
      abandonedCartStep3Sent: number;
      errorCount: number;
      errors: string | null;
      success: boolean;
    }

    let formattedLastRun: SchedulerRunSummary | null = lastRun ? {
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
    } : null;

    if (lastFailedMessage) {
      const msgErrorStr = `[Template: ${lastFailedMessage.templateName || 'N/A'}${lastFailedMessage.orderId ? ` | Order: ${lastFailedMessage.orderId}` : ''}] ${lastFailedMessage.errorCode ? `(${lastFailedMessage.errorCode}) ` : ''}${lastFailedMessage.errorMessage || 'Failed to send'}`;
      if (!formattedLastRun) {
        formattedLastRun = {
          id: 'msg-fail-log',
          createdAt: lastFailedMessage.createdAt,
          campaignsProcessed: 0,
          campaignRecipientsRetried: 0,
          messagesRetried: 0,
          abandonedCartStep1Sent: 0,
          abandonedCartStep2Sent: 0,
          abandonedCartStep3Sent: 0,
          errorCount: 1,
          errors: msgErrorStr,
          success: false
        };
      } else if (!formattedLastRun.errors || new Date(lastFailedMessage.createdAt).getTime() > new Date(formattedLastRun.createdAt).getTime()) {
        formattedLastRun.errors = msgErrorStr;
        formattedLastRun.success = false;
      }
    }

    return NextResponse.json({
      success: true,
      lastRun: formattedLastRun,
      sends24h: templateCounts
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[WhatsApp Scheduler Stats API] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
