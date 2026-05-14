import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createOrder } from '@/lib/shopify-admin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Check if already synced
    const isAlreadySynced = /^\d+$/.test(order.shopifyOrderId) && order.shopifyOrderId.length > 5;
    
    if (isAlreadySynced) {
      // If already synced, just ensure status is approved
      await prisma.order.update({
        where: { id },
        data: { status: 'approved' }
      });
      return NextResponse.json({ success: true, message: 'Order already synced, status updated to approved.' });
    }

    // Prepare Shopify order data
    const shopifyLineItems = order.items.map((item) => {
      // Try to parse variant ID if it looks like a number or GID
      let variantId: number | undefined;
      if (item.sku && /^\d+$/.test(item.sku)) {
        variantId = parseInt(item.sku, 10);
      }
      
      if (variantId) {
        return { variant_id: variantId, quantity: item.quantity };
      }
      return {
        title: item.title,
        price: item.price.toFixed(2),
        quantity: item.quantity,
        requires_shipping: true,
      };
    });

    let shippingAddr: any = {};
    try {
      shippingAddr = order.shippingAddress ? JSON.parse(order.shippingAddress) : {};
    } catch (e) {
      console.warn('Failed to parse shipping address for sync');
    }

    const shopifyOrderData: any = {
      line_items: shopifyLineItems,
      billing_address: {
        first_name: order.customer.name?.split(' ')[0] || 'Customer',
        last_name: order.customer.name?.split(' ').slice(1).join(' ') || '.',
        address1: shippingAddr.address1 || shippingAddr.street || 'No Address',
        city: shippingAddr.city || 'No City',
        province: shippingAddr.province || shippingAddr.state || '',
        zip: shippingAddr.zip || shippingAddr.pincode || '',
        country: shippingAddr.country || 'INDIA',
        phone: order.customer.phone || ''
      },
      shipping_address: {
        first_name: order.customer.name?.split(' ')[0] || 'Customer',
        last_name: order.customer.name?.split(' ').slice(1).join(' ') || '.',
        address1: shippingAddr.address1 || shippingAddr.street || 'No Address',
        city: shippingAddr.city || 'No City',
        province: shippingAddr.province || shippingAddr.state || '',
        zip: shippingAddr.zip || shippingAddr.pincode || '',
        country: shippingAddr.country || 'INDIA',
        phone: order.customer.phone || ''
      },
      phone: order.customer.phone || null,
      email: order.customer.email || null,
      financial_status: order.paymentMethod === 'COD' ? 'pending' : 'paid',
      note: `Approved App Order: ${order.note || ''}`,
      tags: `AppOrder, MobileApp, ${order.paymentMethod === 'COD' ? 'COD' : 'Prepaid'}, Approved`,
      currency: order.currency || "INR"
    };

    if (order.customer.shopifyId && /^\d+$/.test(order.customer.shopifyId)) {
      shopifyOrderData.customer = { id: parseInt(order.customer.shopifyId, 10) };
    }

    // Create in Shopify
    const sOrder = await createOrder(shopifyOrderData);
    
    // Update local order with real Shopify ID and status
    await prisma.order.update({
      where: { id },
      data: {
        shopifyOrderId: sOrder.id.toString(),
        status: 'approved',
        tags: `AppOrder, MobileApp, ${order.paymentMethod === 'COD' ? 'COD' : 'Prepaid'}, Approved`
      }
    });

    return NextResponse.json({ 
      success: true, 
      shopifyOrderId: sOrder.id.toString(),
      message: 'Order successfully synced to Shopify and approved.'
    });

  } catch (error: any) {
    console.error('[Admin Order Approve API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
