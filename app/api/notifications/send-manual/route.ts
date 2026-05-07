import { NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification.service';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, body: msgBody, imageUrl, targetType, targetValue, deepLinkType, deepLinkId } = body;

    if (!title || !msgBody || !targetType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const notificationPayload = {
      type: deepLinkType || 'none',
      id: deepLinkId || '',
      imageUrl: imageUrl || ''
    };

    // Store the send log
    const sendRecord = await db.notificationSend.create({
      data: {
        title,
        body: msgBody,
        imageUrl,
        data: JSON.stringify(notificationPayload),
        targetType,
        targetValue,
        deepLinkType,
        deepLinkId,
        status: 'sending'
      }
    });

    let result;
    if (targetType === 'user') {
      result = await NotificationService.sendToUser(targetValue, title, msgBody, notificationPayload);
    } else if (targetType === 'all') {
      // In production you would do this with a background worker, streaming from DB
      const devices = await db.deviceToken.findMany({ where: { isActive: true }, select: { fcmToken: true } });
      const tokens = devices.map(d => d.fcmToken);
      result = await NotificationService.sendToTokens(tokens, title, msgBody, notificationPayload);
    } else if (targetType === 'segment') {
      // VIP Segment: Customers with more than 3 orders
      const vipCustomers = await db.customer.findMany({
        where: { ordersCount: { gt: 3 } },
        select: { id: true }
      });
      const customerIds = vipCustomers.map(c => c.id);
      const devices = await db.deviceToken.findMany({ 
        where: { userId: { in: customerIds }, isActive: true }, 
        select: { fcmToken: true } 
      });
      const tokens = devices.map(d => d.fcmToken);
      result = await NotificationService.sendToTokens(tokens, title, msgBody, notificationPayload);
    }

    // Update log
    await db.notificationSend.update({
      where: { id: sendRecord.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount: (result as any)?.successCount + (result as any)?.failureCount || 0,
        deliveredCount: (result as any)?.successCount || 0,
        failedCount: (result as any)?.failureCount || 0
      }
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Manual notification send error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
