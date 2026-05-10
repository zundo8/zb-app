import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

export async function GET() {
  try {
    const creds = await resolveRazorpayCredentials();
    return NextResponse.json({
      source: creds.source,
      key_id_start: creds.key_id.slice(0, 10),
      secret_length: creds.key_secret.length,
      secret_start: creds.key_secret.slice(0, 4),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
