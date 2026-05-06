import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOrder, createCustomer } from '@/lib/shopify-admin';

/**
 * POST /api/admin/orders/[id]/sync-shopify
 * Syncs a local mobile order to Shopify by creating a new Shopify order.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Fetch the local order with full details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // If already synced to Shopify, return the existing ID
    if (order.shopifyOrderId && !order.shopifyOrderId.startsWith('local_') && !order.shopifyOrderId.startsWith('app_')) {
      return NextResponse.json({ 
        success: true, 
        shopifyOrderId: order.shopifyOrderId,
        message: 'Order already synced to Shopify' 
      });
    }

    // Parse shipping address
    let shippingAddress: any = {};
    try {
      shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : {};
    } catch {
      shippingAddress = {};
    }

    // Resolve Shopify customer
    let shopifyCustomerId = order.customer?.shopifyId;

    if (!shopifyCustomerId || shopifyCustomerId.startsWith('temp_') || shopifyCustomerId.startsWith('google_')) {
      // Create a new Shopify customer
      try {
        const customerName = order.customer?.name || 'App User';
        const nameParts = customerName.split(' ');
        const shopifyCustomer = await createCustomer({
          first_name: nameParts[0] || 'App',
          last_name: nameParts.slice(1).join(' ') || 'User',
          email: order.customer?.email || '',
          phone: order.customer?.phone || '',
          verified_email: true,
          addresses: shippingAddress.street ? [{
            address1: shippingAddress.street || shippingAddress.address1 || '',
            city: shippingAddress.city || '',
            province: shippingAddress.state || shippingAddress.province || '',
            zip: shippingAddress.zip || '',
            country: shippingAddress.country || 'India',
            default: true,
          }] : [],
        });

        shopifyCustomerId = shopifyCustomer.id.toString();
        
        // Update local customer record
        if (order.customer) {
          await prisma.customer.update({
            where: { id: order.customer.id },
            data: { shopifyId: shopifyCustomerId },
          });
        }
      } catch (e) {
        console.error('[Sync] Shopify customer creation failed:', e);
        // Continue without customer — Shopify will create one
      }
    }

    // Build Shopify order payload
    const shopifyOrderPayload: any = {
      line_items: order.items.map((item) => {
        // Mobile app stores Shopify variant id as `sku: variant:<id>` for later sync.
        const sku = item.sku || '';
        const m = sku.match(/variant:(\d+)/i);
        if (m?.[1]) {
          return {
            variant_id: parseInt(m[1], 10),
            quantity: item.quantity,
          };
        }
        // Fallback: create custom item (not ideal, but keeps admin unblocked).
        return {
          title: item.title,
          quantity: item.quantity,
          price: item.price.toFixed(2),
          requires_shipping: true,
        };
      }),
      financial_status: order.paymentStatus === 'paid' ? 'paid' : 'pending',
      note: `Synced from Mobile App | Payment: ${order.paymentMethod || 'Unknown'} | InternalOrderId: ${order.id}`,
      tags: `mobile-app, SyncedFromAdmin, ${order.tags || ''}`.replace(/\s+/g, ' ').trim(),
      total_tax: 0,
      currency: order.currency || 'INR',
    };

    // Add customer
    if (shopifyCustomerId && !shopifyCustomerId.startsWith('temp_') && !shopifyCustomerId.startsWith('google_')) {
      shopifyOrderPayload.customer = { id: parseInt(shopifyCustomerId) };
    }

    // Add shipping address
    if (shippingAddress.name || shippingAddress.street || shippingAddress.address1) {
      const nameParts = (shippingAddress.name || order.customer?.name || '').split(' ');
      shopifyOrderPayload.shipping_address = {
        first_name: nameParts[0] || 'App',
        last_name: nameParts.slice(1).join(' ') || 'User',
        address1: shippingAddress.street || shippingAddress.address1 || '',
        city: shippingAddress.city || '',
        province: shippingAddress.state || shippingAddress.province || '',
        zip: shippingAddress.zip || '',
        country: shippingAddress.country || 'India',
      };
      shopifyOrderPayload.billing_address = shopifyOrderPayload.shipping_address;
    }

    // Create order in Shopify
    const shopifyOrder = await createOrder(shopifyOrderPayload);

    // Update local order with Shopify ID
    await prisma.order.update({
      where: { id: orderId },
      data: { 
        shopifyOrderId: shopifyOrder.id.toString(),
        tags: `AppOrder, MobileApp, Synced, ${order.paymentMethod || 'Razorpay'}`,
      },
    });

    return NextResponse.json({ 
      success: true, 
      shopifyOrderId: shopifyOrder.id.toString(),
      shopifyOrderName: shopifyOrder.name,
    });

  } catch (error: any) {
    console.error('[Sync] Shopify sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
