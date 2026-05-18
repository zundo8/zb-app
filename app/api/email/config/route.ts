import { NextRequest, NextResponse } from 'next/server';
import { resolvedSMTP } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const senderName = process.env.ZOHO_FROM_NAME || 'Zica Bella';
    
    return NextResponse.json({
      success: true,
      config: {
        host: resolvedSMTP.host,
        port: resolvedSMTP.port,
        user: resolvedSMTP.user,
        senderName: senderName,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
