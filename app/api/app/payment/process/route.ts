import Razorpay from 'razorpay';
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

    const instance = new Razorpay({
      key_id,
      key_secret,
    });

    const body = await req.json();

    // Required fields
    const { order_id, amount, method, email, contact, name } = body;

    if (!order_id || !amount || !method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsJsonHeaders });
    }

    const payload: any = {
      amount: Math.round(Number(amount)),
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

    console.log(`[Razorpay Process] Initiating ${method} payment for order ${order_id} using ${source} keys`);

    // S2S Payment Initiation
    // @ts-ignore - payments.create exists in recent SDK versions but might not be in all @types
    const payment = await instance.payments.create(payload);

    return NextResponse.json(payment, { headers: corsJsonHeaders });
  } catch (err: any) {
    console.error('Razorpay process error:', err);
    
    // Check for specific error types from Razorpay SDK
    const message = err.error?.description || err.message || 'Payment initiation failed';
    const statusCode = err.statusCode || 500;

    return NextResponse.json(
      { error: message, code: err.error?.code, source },
      { status: statusCode, headers: corsJsonHeaders }
    );
  }
}
