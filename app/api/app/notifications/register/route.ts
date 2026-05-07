import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getAppAuthFromRequest } from '@/lib/appAuth';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const auth = getAppAuthFromRequest(req);
  
  try {
    const { token, deviceId, platform, appVersion } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400, headers: corsHeaders });
    }

    // Upsert device token
    // If auth exists, link to customer. Otherwise, just store token with deviceId
    const data: any = {
      fcmToken: token,
      platform: platform || 'ios',
      appVersion: appVersion || '1.0.0',
      isActive: true,
      updatedAt: new Date(),
    };

    if (auth?.customerId) {
      data.userId = auth.customerId;
    }

    if (deviceId) {
      await prisma.deviceToken.upsert({
        where: {
          userId_deviceId: {
            userId: auth?.customerId || 'GUEST',
            deviceId: deviceId,
          },
        },
        update: data,
        create: {
          ...data,
          userId: auth?.customerId || 'GUEST',
          deviceId: deviceId,
        },
      });
    } else {
      // Fallback if no deviceId provided, just update/create by token
      await prisma.deviceToken.upsert({
        where: {
          fcmToken: token,
        },
        update: data,
        create: {
          ...data,
          userId: auth?.customerId || 'GUEST',
          deviceId: `gen_${Date.now()}`,
        },
      });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });

  } catch (e: any) {
    console.error('[Notification Register] Error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
