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
  <tr>
    <td style="padding: 10px; border-bottom: 1px solid #eee; width: 70px;">
      ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;" />` : `<div style="width: 60px; height: 60px; background-color: #f5f5f5; border-radius: 6px;"></div>`}
    </td>
    <td style="padding: 10px; border-bottom: 1px solid #eee;">
      <strong style="display: block; margin-bottom: 4px;">${item.name}</strong>
      ${item.size ? `<span style="font-size: 12px; color: #666;">Size: ${item.size}</span>` : ''}
    </td>
    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${currencySymbol}${item.price}</td>
  </tr>
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
  const itemsHtml = `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <th style="text-align:left;padding:10px;border-bottom:2px solid #ccc; width: 70px;"></th>
      <th style="text-align:left;padding:10px;border-bottom:2px solid #ccc;">Item</th>
      <th style="text-align:center;padding:10px;border-bottom:2px solid #ccc;">Qty</th>
      <th style="text-align:right;padding:10px;border-bottom:2px solid #ccc;">Price</th>
    </tr>
    ${getItemsHtml(order.items, currencySymbol)}
  </table>`;

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

    await sendDynamicEmail('confirmation', order, fallback.subject, fallback.html, fallback.text);

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

    await sendDynamicEmail('cod_confirmation', order, fallback.subject, fallback.html, fallback.text);

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

    await sendDynamicEmail('shipped', order, fallback.subject, fallback.html, fallback.text, {
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

    await sendDynamicEmail('delivered', order, fallback.subject, fallback.html, fallback.text);

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

    await sendDynamicEmail('cancelled', order, fallbackSubject, fallbackHtml, fallbackText, {
      reason: 'Requested by customer or out of stock'
    });

    console.log(`[OrderEmailService] Cancellation email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send cancellation email for Order #${order.orderId}:`, error);
  }
}
