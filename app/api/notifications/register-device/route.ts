import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * POST /api/notifications/register-device
 * 
 * Stores or updates a device's push tokens.
 * Handles both Expo tokens and Native APNs tokens for reliable iOS delivery.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, deviceId, fcmToken, expoPushToken, deviceToken, platform, appVersion } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }

    const finalUserId = userId || `GUEST_${deviceId}`;
    
    // Use the native deviceToken if provided, otherwise fallback to fcmToken
    const apnsToken = deviceToken || (fcmToken && !fcmToken.startsWith('ExponentPushToken') ? fcmToken : null);
    // Use the expoPushToken if provided, otherwise check if fcmToken is an expo token
    const expoToken = expoPushToken || (fcmToken && fcmToken.startsWith('ExponentPushToken') ? fcmToken : null);

    const record = await db.deviceToken.upsert({
      where: {
        userId_deviceId: {
          userId: finalUserId,
          deviceId,
        },
      },
      update: {
        fcmToken: expoToken || apnsToken || fcmToken, // Store the most reliable one in the primary field
        expoPushToken: expoToken,
        apnsToken: apnsToken,
        platform: platform || 'ios',
        appVersion,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: finalUserId,
        deviceId,
        fcmToken: expoToken || apnsToken || fcmToken,
        expoPushToken: expoToken,
        apnsToken: apnsToken,
        platform: platform || 'ios',
        isActive: true,
        appVersion,
      },
    });

    return NextResponse.json({ success: true, id: record.id });
  } catch (error: any) {
    console.error('Device registration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
