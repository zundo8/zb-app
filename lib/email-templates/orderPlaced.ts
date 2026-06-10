import { baseEmailLayout } from './base';

export interface OrderEmailData {
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
  currency?: string; // default "INR"
  orderDate?: string;
}

export function orderPlacedEmail(data: OrderEmailData): { subject: string; html: string; text: string } {
  const currencySymbol = data.currency === 'USD' ? '$' : '₹';
  const currencyCode = data.currency || 'INR';
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const orderDateStr = data.orderDate || new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const subject = `Order Confirmed — #${data.orderId} | Zica Bella`;

  // Build items HTML
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #eaeaea;">
      <td style="padding: 15px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
        <span style="font-weight: 600; color: #1a1a1a; font-size: 15px;">${item.name}</span>
        ${item.size ? `<br/><span style="font-size: 13px; color: #666666;">Size: ${item.size}</span>` : ''}
      </td>
      <td style="padding: 15px 0; text-align: center; color: #666666; font-size: 14px;">
        Qty: ${item.quantity}
      </td>
      <td style="padding: 15px 0; text-align: right; font-weight: 600; color: #1a1a1a; font-size: 15px;">
        ${currencySymbol}${item.price}
      </td>
    </tr>
  `
    )
    .join('');

  // HTML Body
  const htmlContent = `
    <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 300; color: #000000; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #C9A96E; padding-bottom: 10px;">
      Your order is confirmed ✓
    </h2>
    
    <p style="margin: 0 0 20px 0;">Hi ${firstName},</p>
    
    <p style="margin: 0 0 25px 0;">
      Thank you for shopping with us! We have received your order <strong>#${data.orderId}</strong> and are preparing it with care.
    </p>

    <div style="background-color: #fcfbf9; border-left: 3px solid #C9A96E; padding: 20px; margin-bottom: 30px; border-radius: 0 4px 4px 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="color: #666666; padding-bottom: 8px;">Order Reference:</td>
          <td style="font-weight: bold; text-align: right; padding-bottom: 8px;">#${data.orderId}</td>
        </tr>
        <tr>
          <td style="color: #666666;">Order Date:</td>
          <td style="font-weight: bold; text-align: right;">${orderDateStr}</td>
        </tr>
      </table>
    </div>

    <h3 style="font-family: Georgia, serif; font-size: 18px; font-weight: 300; color: #000000; margin-bottom: 15px;">
      Items Ordered
    </h3>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 25px;">
      <thead>
        <tr style="border-bottom: 2px solid #C9A96E; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666666;">
          <th align="left" style="padding-bottom: 10px;">Item</th>
          <th align="center" style="padding-bottom: 10px;">Qty</th>
          <th align="right" style="padding-bottom: 10px;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
      <tr>
        <td style="font-size: 16px; font-weight: 600; color: #000000;">Total Paid</td>
        <td align="right" style="font-size: 20px; font-weight: 700; color: #C9A96E;">
          ${currencySymbol}${data.total} <span style="font-size: 12px; color: #888888; font-weight: normal;">${currencyCode}</span>
        </td>
      </tr>
    </table>

    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; margin-bottom: 30px; border: 1px solid #eee;">
      <h4 style="margin: 0 0 8px 0; font-family: Georgia, serif; color: #000000; font-size: 15px;">Estimated Delivery</h4>
      <p style="margin: 0; font-size: 14px; color: #555555; line-height: 1.5;">
        Your Zica Bella creations will be delivered within <strong>5 to 7 business days</strong>. We will send you another email with tracking details as soon as it ships.
      </p>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://zicabella.com/orders/${data.orderId}" style="display: inline-block; background-color: #C9A96E; color: #000000; text-decoration: none; padding: 14px 35px; border-radius: 4px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; box-shadow: 0 4px 12px rgba(201, 169, 110, 0.3);">
        Track Your Order
      </a>
    </div>

    <p style="margin: 0 0 5px 0; font-style: italic; color: #555555; text-align: center;">
      We're crafting your pieces with care.
    </p>
    <p style="margin: 0; color: #888888; text-align: center; font-size: 13px;">
      Warmly,<br/>The Zica Bella Team
    </p>
  `;

  // Plain-Text Fallback
  const textContent = `
Your order is confirmed ✓
Hi ${firstName},

Thank you for shopping with us! We have received your order #${data.orderId} on ${orderDateStr}.

Items Ordered:
${data.items.map((item) => `- ${item.name} (Size: ${item.size || 'N/A'}, Qty: ${item.quantity}) - ${currencySymbol}${item.price}`).join('\n')}

Total Paid: ${currencySymbol}${data.total} ${currencyCode}

Estimated Delivery:
Your Zica Bella creations will be delivered within 5 to 7 business days.

Track your order here: https://zicabella.com/orders/${data.orderId}

We're crafting your pieces with care.

Warmly,
The Zica Bella Team
  `.trim();

  return {
    subject,
    html: baseEmailLayout(htmlContent, `Order #${data.orderId} Confirmed`),
    text: textContent,
  };
}
