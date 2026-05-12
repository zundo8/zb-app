import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/mailer';
import { orderConfirmationTemplate, newOrderAdminTemplate } from '@/lib/email-templates';
import { logEmail } from '@/lib/log-email';
import { verifyShopifyWebhook } from '@/lib/shopify-webhooks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const hmac = req.headers.get('x-shopify-hmac-sha256');

    if (!hmac || !verifyShopifyWebhook(body, hmac)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const order = JSON.parse(body);
    const customerEmail = order.email || order.contact_email;
    
    if (!customerEmail) {
      return NextResponse.json({ error: 'No customer email found' }, { status: 400 });
    }

    /* 
    // 1. Send Order Confirmation to Customer (Disabled as per user request to not use for Shopify customers)
    const customerHtml = orderConfirmationTemplate({
      customerName: `${order.customer?.first_name || 'Customer'}`,
      orderId: order.name,
      orderDate: new Date(order.created_at).toLocaleDateString(),
      items: order.line_items.map((item: any) => ({
        name: item.title,
        size: item.variant_title || 'N/A',
        qty: item.quantity,
        price: `${order.currency} ${item.price}`,
      })),
      subtotal: `${order.currency} ${order.subtotal_price}`,
      shipping: `${order.currency} ${order.total_shipping_price_set?.shop_money?.amount || '0.00'}`,
      total: `${order.currency} ${order.total_price}`,
      shippingAddress: `${order.shipping_address?.address1}, ${order.shipping_address?.city}, ${order.shipping_address?.province}, ${order.shipping_address?.zip}, ${order.shipping_address?.country}`,
    });

    const customerMail = await sendMail({
      to: customerEmail,
      subject: `Order Confirmation - ${order.name}`,
      html: customerHtml,
    });

    await logEmail({
      recipientEmail: customerEmail,
      recipientName: `${order.customer?.first_name} ${order.customer?.last_name}`,
      subject: `Order Confirmation - ${order.name}`,
      templateName: 'orderConfirmation',
      triggerEvent: 'orders/create',
      referenceId: order.id.toString(),
      status: customerMail.messageId ? 'sent' : 'failed',
      messageId: customerMail.messageId,
    });
    */


    // 2. Send New Order Alert to Admin
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@zicabella.com';
    const adminHtml = newOrderAdminTemplate({
      orderId: order.name,
      customerName: `${order.customer?.first_name} ${order.customer?.last_name}`,
      customerEmail: customerEmail,
      totalAmount: `${order.currency} ${order.total_price}`,
      items: order.line_items.map((item: any) => ({
        name: item.title,
        qty: item.quantity,
      })),
      orderUrl: `https://app.zicabella.com/orders/${order.id}`,
    });

    const adminMail = await sendMail({
      to: adminEmail,
      subject: `New Order Received - ${order.name}`,
      html: adminHtml,
    });

    await logEmail({
      recipientEmail: adminEmail,
      subject: `New Order Received - ${order.name}`,
      templateName: 'newOrderAdmin',
      triggerEvent: 'orders/create',
      referenceId: order.id.toString(),
      status: adminMail.messageId ? 'sent' : 'failed',
      messageId: adminMail.messageId,
      sentBy: 'system-admin-alert',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Order Confirmation Email Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
