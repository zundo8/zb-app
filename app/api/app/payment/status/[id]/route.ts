import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';

const corsJsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsJsonHeaders });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { key_id, key_secret } = await resolveRazorpayCredentials();

    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

    const response = await fetch(`https://api.razorpay.com/v1/payments/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: response.status, headers: corsJsonHeaders });
    }

    return NextResponse.json({
      status: data.status,
      method: data.method,
      amount: data.amount,
      error_code: data.error_code,
      error_description: data.error_description,
    }, { headers: corsJsonHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsJsonHeaders });
  }
}
