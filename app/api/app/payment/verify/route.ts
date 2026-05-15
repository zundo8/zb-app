import crypto from 'crypto';
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

import { resolveRazorpayCredentials } from '@/lib/razorpay-credentials';
import prisma from '@/lib/db';

const corsJsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsJsonHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    
    if (!razorpay_order_id || !razorpay_payment_id) {
      console.error('[Verify] Missing fields:', { razorpay_order_id, razorpay_payment_id, has_signature: !!razorpay_signature });
      return NextResponse.json(
        { success: false, error: 'Missing payment fields' },
        { status: 400, headers: corsJsonHeaders }
      );
    }

    let secret: string;
    try {
      const creds = await resolveRazorpayCredentials();
      secret = creds.key_secret.trim();
    } catch (credErr: any) {
      console.error('[Verify] Credential resolution failed:', credErr.message);
      return NextResponse.json(
        { success: false, error: 'Payment gateway not configured correctly.' },
        { status: 500, headers: corsJsonHeaders }
      );
    }

    if (razorpay_signature && razorpay_signature !== 'HEADLESS') {
      // Razorpay signature verification logic:
      // HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      const isValid = expectedSignature === razorpay_signature;

      if (!isValid) {
        console.error('[Verify] Signature mismatch:', {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          received: razorpay_signature.slice(0, 10) + '...',
          expected: expectedSignature.slice(0, 10) + '...',
        });
        return NextResponse.json(
          { success: false, error: 'Payment verification failed: Signature mismatch.' },
          { status: 400, headers: corsJsonHeaders }
        );
      }
    } else {
      const creds = await resolveRazorpayCredentials();
      const razorpay = new Razorpay({
        key_id: creds.key_id.trim(),
        key_secret: secret,
      });
      const payment: any = await razorpay.payments.fetch(razorpay_payment_id);

      if (payment.order_id !== razorpay_order_id) {
        console.error('[Verify] Payment/order mismatch:', {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          payment_order_id: payment.order_id,
        });
        return NextResponse.json(
          { success: false, error: 'Payment verification failed: order mismatch.' },
          { status: 400, headers: corsJsonHeaders }
        );
      }

      if (!['captured', 'authorized'].includes(payment.status)) {
        return NextResponse.json(
          { success: false, error: `Payment is not complete yet (${payment.status}).` },
          { status: 400, headers: corsJsonHeaders }
        );
      }
    }

    console.log(`[Verify] ✅ Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);

    // Update local order status immediately to avoid race conditions with webhook
    try {
      const order = await prisma.order.findUnique({
        where: { razorpayOrderId: razorpay_order_id },
        include: { items: true, customer: true }
      });
      if (order && order.paymentStatus !== 'paid') {
        const now = new Date();
        
        // ─── Sync with Shopify ───
        let shopifyOrderId = order.shopifyOrderId;
        let tags = order.tags || 'mobile-app';
        
        if (!shopifyOrderId || shopifyOrderId.startsWith('#') || shopifyOrderId.startsWith('ZB')) {
          try {
            const { createOrder, createCustomer } = await import('@/lib/shopify-admin');
            const { extractNumericId } = await import('@/lib/utils');
            
            // Ensure customer exists in Shopify
            let shopifyCustomerId = order.customer?.shopifyId;
            if (!shopifyCustomerId || shopifyCustomerId.startsWith('GUEST_') || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('app_')) {
                const nameParts = String(order.customer?.name || 'App User').split(' ');
                try {
                  const createdCustomer = await createCustomer({
                      first_name: nameParts[0] || 'App',
                      last_name: nameParts.slice(1).join(' ') || 'User',
                      email: order.customer?.email || `guest_${Date.now()}@zicabella.com`,
                      phone: order.customer?.phone || '',
                      verified_email: true
                  });
                  shopifyCustomerId = String(createdCustomer.id);
                  await prisma.customer.update({ where: { id: order.customerId! }, data: { shopifyId: shopifyCustomerId } });
                } catch (ce) {
                  console.error('[Verify] Shopify customer creation failed:', ce);
                }
            }

            const address = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress;

            const shopifyOrderRes = await createOrder({
                line_items: order.items.map((li: any) => {
                    let vid = extractNumericId(li.sku?.startsWith('variant:') ? li.sku.split(':')[1] : li.sku);
                    return {
                        variant_id: vid ? parseInt(vid, 10) : null,
                        quantity: li.quantity,
                        title: li.title,
                        price: String(li.price),
                    };
                }).filter((li: any) => li.variant_id),
                financial_status: 'paid',
                tags: `${tags}, synced`,
                note: `Verified App Order | Razorpay: ${razorpay_payment_id}`,
                currency: 'INR',
                customer: shopifyCustomerId && !shopifyCustomerId.includes('GUEST') ? { id: parseInt(shopifyCustomerId, 10) } : undefined,
                shipping_address: {
                    first_name: address?.first_name || address?.name?.split(' ')[0] || 'App',
                    last_name: address?.last_name || address?.name?.split(' ').slice(1).join(' ') || 'User',
                    address1: address?.address1 || address?.line1 || address?.street || '',
                    address2: address?.address2 || address?.line2 || '',
                    city: address?.city || '',
                    province: address?.province || address?.state || '',
                    zip: address?.zip || address?.pincode || '',
                    country: address?.country || 'India',
                    phone: address?.phone || '',
                },
            });
            shopifyOrderId = String(shopifyOrderRes.id);
            tags = `${tags}, synced`;
          } catch (shopifyErr: any) {
            console.error('[Verify] Shopify sync failed:', shopifyErr.message);
          }
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'paid',
            razorpayPaymentId: razorpay_payment_id,
            paymentCapturedAt: now,
            shopifyOrderId: shopifyOrderId,
            tags: tags,
            status: 'approved', // Auto-approved upon payment
          }
        });
        
        // Record payment
        await prisma.payment.create({
          data: {
            orderId: order.id,
            customerId: order.customerId!,
            amount: order.totalPrice,
            type: 'CAPTURE',
            status: 'success',
            gateway: 'razorpay',
          }
        });
        console.log(`[Verify] Local order ${order.id} marked as PAID and synced to Shopify`);
      }
    } catch (dbErr: any) {
      console.warn('[Verify] Failed to update local order:', dbErr.message);
    }

    return NextResponse.json({ success: true, payment_id: razorpay_payment_id }, { headers: corsJsonHeaders });
  } catch (err: unknown) {
    console.error('[Verify] Internal Error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error during verification' },
      { status: 500, headers: corsJsonHeaders }
    );
  }
}
