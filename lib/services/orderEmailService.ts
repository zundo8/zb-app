import { sendEmail } from '@/lib/mailer';
import { 
  orderPlacedEmail, 
  orderShippedEmail, 
  orderDeliveredEmail,
  orderCancelledTemplate,
  renderDBTemplate
} from '@/lib/email-templates';

export interface OrderData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  items: Array<{
    name: string;
    size?: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  total: number;
  currency?: string;
  orderDate?: string;
  paymentMethod?: string;
}

function getItemsHtml(items: OrderData['items'], currencySymbol: string) {
  return items.map(
    (item) => `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(255,255,255,0.15); border-radius:2px; overflow:hidden; margin-bottom: 15px;">
          <tr>
            <td class="item-img" width="110" style="vertical-align:top; padding:0;">
              ${item.image ? `<img src="${item.image}" width="110" height="130" style="display:block; object-fit:cover; opacity:0.8;" alt="${item.name}" />` : `<div style="width:110px; height:130px; background:rgba(255,255,255,0.05);"></div>`}
            </td>
            <td style="vertical-align:top; padding:20px 20px 20px 22px; border-left:1px solid rgba(255,255,255,0.1);">
              <p style="margin:0 0 4px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.3); text-transform:uppercase;">Qty: ${item.quantity}</p>
              <p style="margin:0 0 6px; font-family:'DM Serif Display',serif; font-size:17px; color:rgba(255,255,255,0.7); line-height:1.3;">${item.name}</p>
              ${item.size ? `<p style="margin:0 0 14px; font-family:'DM Mono',monospace; font-size:10px; color:rgba(255,255,255,0.3);">Size: ${item.size}</p>` : ''}
              <p style="margin:0; font-family:'DM Mono',monospace; font-size:12px; color:rgba(255,255,255,0.5);">${currencySymbol}${item.price}</p>
            </td>
          </tr>
        </table>
  `).join('');
}

async function sendDynamicEmail(
  trigger: string,
  order: OrderData,
  fallbackSubject: string,
  fallbackHtml: string,
  fallbackText: string,
  extraVars: Record<string, any> = {}
) {
  const currencySymbol = order.currency === 'USD' ? '$' : '₹';
  const currencyCode = order.currency || 'INR';
  const orderDateStr = order.orderDate || new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const itemsHtml = getItemsHtml(order.items, currencySymbol);

  const variables = {
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    orderId: order.orderId,
    total: `${currencySymbol}${order.total} ${currencyCode}`,
    totalPrice: `${currencySymbol}${order.total} ${currencyCode}`,
    amount: `${currencySymbol}${order.total}`,
    price: `${currencySymbol}${order.total}`,
    currency: currencyCode,
    orderDate: orderDateStr,
    itemsHtml: itemsHtml,
    items: itemsHtml,
    products: itemsHtml,
    paymentMethod: order.paymentMethod || 'Prepaid',
    orderStatusUrl: `https://zicabella.com/orders/${order.orderId}`,
    ...extraVars
  };

  const { subject, html } = await renderDBTemplate(trigger, variables, () => fallbackHtml);
  
  await sendEmail({
    to: order.customerEmail,
    subject: subject || fallbackSubject,
    html: html,
    text: html === fallbackHtml ? fallbackText : 'Please view this email in a modern email client.',
  });
}

/**
 * Sends a premium order confirmation email to the customer
 */
export async function sendOrderConfirmationEmail(order: OrderData): Promise<void> {
  try {
    console.log(`[OrderEmailService] Building confirmation email for Order #${order.orderId}`);
    
    const fallback = orderPlacedEmail({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      currency: order.currency || 'INR',
      orderDate: order.orderDate,
    });

    await sendDynamicEmail('ORDER_CONFIRMATION', order, fallback.subject, fallback.html, fallback.text);

    console.log(`[OrderEmailService] Order confirmation email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send order confirmation email for Order #${order.orderId}:`, error);
  }
}

/**
 * Sends a COD order confirmation email to the customer
 */
export async function sendOrderCodConfirmationEmail(order: OrderData): Promise<void> {
  try {
    console.log(`[OrderEmailService] Building COD confirmation email for Order #${order.orderId}`);
    
    const fallback = orderPlacedEmail({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      currency: order.currency || 'INR',
      orderDate: order.orderDate,
    });

    fallback.subject = `COD Order Confirmed — #${order.orderId} | Zica Bella`;
    fallback.text = `Your Cash on Delivery order has been placed successfully.\n\n` + fallback.text;

    await sendDynamicEmail('ORDER_CONFIRMATION', order, fallback.subject, fallback.html, fallback.text);

    console.log(`[OrderEmailService] COD confirmation email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send COD confirmation email for Order #${order.orderId}:`, error);
  }
}

/**
 * Sends a shipping notification email to the customer with courier and tracking info
 */
export async function sendOrderShippedEmail(
  order: OrderData & { trackingNumber?: string; courier?: string }
): Promise<void> {
  try {
    console.log(`[OrderEmailService] Building shipping email for Order #${order.orderId}`);
    
    const fallback = orderShippedEmail({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      currency: order.currency || 'INR',
      orderDate: order.orderDate,
      trackingNumber: order.trackingNumber,
      courier: order.courier,
    });

    await sendDynamicEmail('ORDER_SHIPPED', order, fallback.subject, fallback.html, fallback.text, {
      trackingNumber: order.trackingNumber || 'N/A',
      courier: order.courier || 'Standard Shipping',
      carrier: order.courier || 'Standard Shipping',
      trackingUrl: order.trackingNumber ? `https://zicabella.com/track?id=${order.trackingNumber}` : 'https://zicabella.com/account/orders'
    });

    console.log(`[OrderEmailService] Shipping notification email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send shipping notification email for Order #${order.orderId}:`, error);
  }
}

/**
 * Sends a delivery confirmation and review request email to the customer
 */
export async function sendOrderDeliveredEmail(order: OrderData): Promise<void> {
  try {
    console.log(`[OrderEmailService] Building delivery email for Order #${order.orderId}`);
    
    const fallback = orderDeliveredEmail({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      currency: order.currency || 'INR',
      orderDate: order.orderDate,
    });

    await sendDynamicEmail('ORDER_DELIVERED', order, fallback.subject, fallback.html, fallback.text);

    console.log(`[OrderEmailService] Delivery email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send delivery email for Order #${order.orderId}:`, error);
  }
}

/**
 * Sends an order cancellation email to the customer
 */
export async function sendOrderCancelledEmail(order: OrderData): Promise<void> {
  try {
    console.log(`[OrderEmailService] Building cancellation email for Order #${order.orderId}`);
    
    const fallbackHtml = orderCancelledTemplate({
      customerName: order.customerName,
      orderId: order.orderId,
      reason: 'Requested by customer or out of stock',
    });

    const fallbackSubject = `Order Cancelled — #${order.orderId} | Zica Bella`;
    const fallbackText = `Your order #${order.orderId} has been cancelled.`;

    await sendDynamicEmail('ORDER_CANCELLED', order, fallbackSubject, fallbackHtml, fallbackText, {
      reason: 'Requested by customer or out of stock'
    });

    console.log(`[OrderEmailService] Cancellation email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send cancellation email for Order #${order.orderId}:`, error);
  }
}
