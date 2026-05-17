import { sendEmail } from '@/lib/mailer';
import { orderPlacedEmail, orderShippedEmail, orderDeliveredEmail } from '@/lib/email-templates';

export interface OrderData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  items: Array<{
    name: string;
    size?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  currency?: string;
  orderDate?: string;
}

/**
 * Sends a premium order confirmation email to the customer
 */
export async function sendOrderConfirmationEmail(order: OrderData): Promise<void> {
  try {
    console.log(`[OrderEmailService] Building confirmation email for Order #${order.orderId}`);
    
    // Map OrderData to OrderEmailData and compile the HTML/Plain Text templates
    const { subject, html, text } = orderPlacedEmail({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      currency: order.currency || 'INR',
      orderDate: order.orderDate,
    });

    await sendEmail({
      to: order.customerEmail,
      subject,
      html,
      text,
    });

    console.log(`[OrderEmailService] Order confirmation email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send order confirmation email for Order #${order.orderId}:`, error);
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
    
    const { subject, html, text } = orderShippedEmail({
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

    await sendEmail({
      to: order.customerEmail,
      subject,
      html,
      text,
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
    
    const { subject, html, text } = orderDeliveredEmail({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderId: order.orderId,
      items: order.items,
      total: order.total,
      currency: order.currency || 'INR',
      orderDate: order.orderDate,
    });

    await sendEmail({
      to: order.customerEmail,
      subject,
      html,
      text,
    });

    console.log(`[OrderEmailService] Delivery email successfully sent for Order #${order.orderId}`);
  } catch (error) {
    console.error(`[OrderEmailService] Failed to send delivery email for Order #${order.orderId}:`, error);
  }
}
