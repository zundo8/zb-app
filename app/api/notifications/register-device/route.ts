import { NextResponse } from 'next/server';
import { NotificationService } from '@/lib/services/notification.service';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, deviceId, fcmToken, platform, appVersion } = body;

    if (!userId || !deviceId || !fcmToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const token = await NotificationService.registerDeviceToken({
      userId,
      deviceId,
      fcmToken,
      platform,
      appVersion
    });

    return NextResponse.json({ success: true, token });
  } catch (error: any) {
    console.error('Device registration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { userId, deviceId } = body;

    if (!userId || !deviceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await NotificationService.unregisterDevice(userId, deviceId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Device unregistration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
