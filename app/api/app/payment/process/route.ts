import { NextResponse } from 'next/server';
import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import { getAppAuthFromRequest } from '@/lib/appAuth';

const corsJsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsJsonHeaders });
}

/**
 * Headless Payment Processor (Server-to-Server)
 * This allows initiating UPI and Netbanking payments without the Razorpay SDK UI.
 */
export async function POST(req: Request) {
  try {
    const userAuth = getAppAuthFromRequest(req);
    if (!userAuth) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401, headers: corsJsonHeaders });
    }

    let { key_id, key_secret, source } = await resolveRazorpayCredentials();
    key_id = key_id.trim();
    key_secret = key_secret.trim();

    console.log(`[Razorpay Process] Using key: ${key_id.slice(0, 10)}... (Secret: ${key_secret.slice(0, 2)}..${key_secret.slice(-2)}, Source: ${source})`);
    const body = await req.json();

    // Required fields
    const { order_id, amount, method, email, contact, name } = body;

    if (!order_id || !amount || !method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsJsonHeaders });
    }

    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

    const payload: any = {
      amount,
      currency: 'INR',
      order_id,
      method,
      email: email || 'customer@zicabella.com',
      contact: contact || '9999999999',
      customer_name: name || 'Zica Customer',
    };

    if (method === 'upi') {
      if (body.vpa) payload.vpa = body.vpa;
      if (body.upi_app) payload.upi_app = body.upi_app;
    } else if (method === 'netbanking') {
      payload.bank = body.bank;
    } else if (method === 'wallet') {
      payload.wallet = body.wallet;
    }

    console.log(`[Razorpay Process] Initiating ${method} payment for order ${order_id}`);

    const response = await fetch('https://api.razorpay.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Razorpay process error:', JSON.stringify(data));
      return NextResponse.json({ 
        error: data.error?.description || 'Payment initiation failed',
        code: data.error?.code 
      }, { status: response.status, headers: corsJsonHeaders });
    }

    return NextResponse.json(data, { headers: corsJsonHeaders });
  } catch (err: any) {
    console.error('Server error in payment process:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsJsonHeaders });
  }
}
