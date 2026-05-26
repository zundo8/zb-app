import { NextResponse } from 'next/server';
import { updateOrderTracking } from '@/lib/delhivery/tracking';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-delhivery-secret');
    const secret = process.env.DELHIVERY_WEBHOOK_SECRET;

    if (!secret || signature !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

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
