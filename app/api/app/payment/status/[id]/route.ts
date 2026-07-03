import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import { getCorsHeaders, handleCorsOptions } from '@/lib/cors';

export async function OPTIONS(req: Request) {
  return handleCorsOptions(req);
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const corsHeaders = getCorsHeaders(req);
  try {
    const { id } = params;
    let { key_id, key_secret } = await resolveRazorpayCredentials();
    key_id = key_id.trim();
    key_secret = key_secret.trim();

    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

    const response = await fetch(`https://api.razorpay.com/v1/payments/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: response.status, headers: corsHeaders });
    }

    return NextResponse.json({
      status: data.status,
      method: data.method,
      amount: data.amount,
      error_code: data.error_code,
      error_description: data.error_description,
    }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
