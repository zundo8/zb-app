import { NextResponse } from 'next/server';
import { updateOrderTracking } from '@/lib/delhivery/tracking';
import { validateWebhookSignature, resolveWebhookSecret } from '@/lib/services/logistics';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = (
      req.headers.get('x-delhivery-signature') ||
      req.headers.get('x-delhivery-secret') ||
      req.headers.get('authorization') || ''
    ).trim();

    const { secret } = await resolveWebhookSecret();

    if (secret && signature) {
      const isValid = validateWebhookSignature(rawBody, signature, secret, 'delhivery');
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (secret && !signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Trigger async processing in a fire-and-forget block to bypass the 500ms timeout
    (async () => {
      try {
        const shipment = payload?.Shipment;
        if (!shipment) {
          console.warn('[Delhivery Webhook] Missing Shipment object in payload.');
          return;
        }

        const awb = shipment.AWB;
        const shopifyOrderId = shipment.ReferenceNo;
        const statusObj = shipment.Status;

        if (!awb || !shopifyOrderId || !statusObj) {
          console.warn('[Delhivery Webhook] Missing critical parameters in payload.', { awb, shopifyOrderId });
          return;
        }

        await updateOrderTracking({
          awb,
          shopifyOrderId,
          status: statusObj.Status || '',
          statusDateTime: statusObj.StatusDateTime || '',
          statusType: statusObj.StatusType || '',
          location: statusObj.StatusLocation || '',
          instructions: statusObj.Instructions || ''
        });
      } catch (err) {
        console.error('[Delhivery Webhook]', err);
      }
    })();

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[Delhivery Webhook]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() { return new Response('Method Not Allowed', { status: 405 }); }
export async function PUT() { return new Response('Method Not Allowed', { status: 405 }); }
export async function DELETE() { return new Response('Method Not Allowed', { status: 405 }); }
export async function PATCH() { return new Response('Method Not Allowed', { status: 405 }); }
export async function HEAD() { return new Response('Method Not Allowed', { status: 405 }); }
