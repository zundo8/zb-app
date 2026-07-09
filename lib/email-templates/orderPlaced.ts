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
    image?: string;
  }>;
  total: number;
  currency?: string; // default "INR"
  orderDate?: string;
  subtotal?: number;
  shipping?: number;
  discount?: number;
  shippingAddress?: string;
  paymentMethod?: string;
}

export function orderPlacedEmail(data: OrderEmailData): { subject: string; html: string; text: string } {
  const currencySymbol = data.currency === 'USD' ? '$' : '₹';
  const currencyCode = data.currency || 'INR';
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const orderDateStr = data.orderDate || new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
  const subject = `Order Confirmed — #${data.orderId} | Zica Bella`;

  const subtotalVal = data.subtotal !== undefined ? data.subtotal : data.total;
  const shippingVal = data.shipping !== undefined ? data.shipping : 0;
  const discountVal = data.discount !== undefined ? data.discount : 0;
  const shippingAddressStr = data.shippingAddress || 'N/A';
  const paymentMethodStr = data.paymentMethod || 'Prepaid';

  // Build items HTML
  const itemsHtml = data.items
    .map((item) => {
      const imgBlock = item.image
        ? `<img src="${item.image}" width="88" height="88" alt="${item.name}" style="display:block; border-radius:1px; object-fit:cover; background:#1a1a1a;" />`
        : `<div style="width:88px; height:88px; background:#1a1a1a; border-radius:1px;"></div>`;
      
      const variantLine = item.size ? `Size: ${item.size}` : '';

      return `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
        <tr>
          <td width="88" valign="top" style="padding-right:16px;">${imgBlock}</td>
          <td valign="middle" style="color:rgba(255,255,255,0.55); font-family:'DM Mono','Courier New',monospace;">
            <p style="margin:0 0 4px; font-size:12px; font-weight:400; color:rgba(255,255,255,0.85); letter-spacing:0.5px;">${item.name}</p>
            ${variantLine ? `<p style="margin:0 0 4px; font-size:10px; font-weight:300; color:rgba(255,255,255,0.4);">${variantLine}</p>` : ''}
            <p style="margin:0; font-size:10px; font-weight:300; color:rgba(255,255,255,0.4);">Qty: ${item.quantity} &nbsp;·&nbsp; ${currencySymbol}${item.price}</p>
          </td>
        </tr>
      </table>
      <div style="height:1px; background:rgba(255,255,255,0.05); margin-bottom:16px;"></div>`;
    })
    .join('');

  // HTML Body
  const htmlContent = `
    <h2 style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 20px; font-weight: 500; color: #ffffff; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 15px; text-transform: uppercase; letter-spacing: 1.5px;">
      Your order is confirmed ✓
    </h2>
    
    <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.7); font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Hi ${firstName},</p>
    
    <p style="margin: 0 0 25px 0; color: rgba(255,255,255,0.6); font-size: 13px; line-height: 1.8; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
      Thank you for shopping with us! We have received your order <strong>#${data.orderId}</strong> and are preparing it with care.
    </p>

    <div style="background-color: rgba(255, 255, 255, 0.02); border-left: 3px solid #C9A96E; padding: 20px; margin-bottom: 30px; border-radius: 0 4px 4px 0;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; font-family:'DM Mono','Courier New',monospace; color: rgba(255,255,255,0.6);">
        <tr>
          <td style="padding-bottom: 8px;">Order Reference:</td>
          <td style="font-weight: bold; text-align: right; color: #ffffff;">#${data.orderId}</td>
        </tr>
        <tr>
          <td>Order Date:</td>
          <td style="font-weight: bold; text-align: right; color: #ffffff;">${orderDateStr}</td>
        </tr>
      </table>
    </div>

    <h3 style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.4); margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1.5px;">
      Items Ordered
    </h3>

    <div style="margin-bottom: 25px;">
      ${itemsHtml}
    </div>

    <!-- Bill Summary Box -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 4px; padding: 20px; color: rgba(255,255,255,0.7); font-family:'DM Mono','Courier New',monospace; font-size: 12px; margin-bottom: 30px;">
      <tr>
        <td style="padding-bottom: 8px; color: rgba(255,255,255,0.45);">Subtotal</td>
        <td align="right" style="padding-bottom: 8px; color: rgba(255,255,255,0.85);">${currencySymbol}${subtotalVal}</td>
      </tr>
      <tr>
        <td style="padding-bottom: 8px; color: rgba(255,255,255,0.45);">Shipping</td>
        <td align="right" style="padding-bottom: 8px; color: rgba(255,255,255,0.85);">${currencySymbol}${shippingVal}</td>
      </tr>
      <tr>
        <td style="padding-bottom: 12px; color: rgba(255,255,255,0.45); border-bottom: 1px solid rgba(255,255,255,0.06);">Discount</td>
        <td align="right" style="padding-bottom: 12px; color: #ff453a; border-bottom: 1px solid rgba(255,255,255,0.06);">-${currencySymbol}${discountVal}</td>
      </tr>
      <tr>
        <td style="padding-top: 12px; font-weight: 500; color: #ffffff; font-size: 14px;">Total</td>
        <td align="right" style="padding-top: 12px; font-weight: 600; color: #C9A96E; font-size: 16px;">
          ${currencySymbol}${data.total} <span style="font-size: 11px; color: rgba(255,255,255,0.4); font-weight: normal;">${currencyCode}</span>
        </td>
      </tr>
    </table>

    <!-- Shipping & Payment Block -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-family:'DM Mono','Courier New',monospace; font-size:11px; line-height:1.7; margin-bottom: 30px;">
      <tr>
        <td width="50%" valign="top" style="padding-right: 15px;">
          <h3 style="font-family:'DM Mono','Courier New',monospace; font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px; margin:0 0 8px 0;">Shipping Address</h3>
          <p style="margin:0; color:rgba(255,255,255,0.65); white-space:pre-line;">${shippingAddressStr}</p>
        </td>
        <td width="50%" valign="top">
          <h3 style="font-family:'DM Mono','Courier New',monospace; font-size:10px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px; margin:0 0 8px 0;">Payment Method</h3>
          <p style="margin:0; color:rgba(255,255,255,0.65); text-transform:uppercase; letter-spacing:0.5px;">${paymentMethodStr}</p>
        </td>
      </tr>
    </table>

    <div style="background-color: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); padding: 20px; border-radius: 4px; margin-bottom: 35px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
      <h4 style="margin: 0 0 8px 0; color: #ffffff; font-size: 14px; font-weight: 500;">Estimated Delivery</h4>
      <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.6;">
        Your Zica Bella creations will be delivered within <strong>5 to 7 business days</strong>. We will send you another email with tracking details as soon as it ships.
      </p>
    </div>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://zicabella.com/orders/${data.orderId}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 14px 35px; border-radius: 2px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; font-size: 11px; font-family:'DM Mono','Courier New',monospace;">
        Track Your Order
      </a>
    </div>

    <p style="margin: 0 0 5px 0; font-style: italic; color: rgba(255,255,255,0.3); text-align: center; font-size: 12px;">
      We're crafting your pieces with care.
    </p>
    <p style="margin: 0; color: rgba(255,255,255,0.4); text-align: center; font-size: 12px;">
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

Subtotal: ${currencySymbol}${subtotalVal}
Shipping: ${currencySymbol}${shippingVal}
Discount: -${currencySymbol}${discountVal}
Total Paid: ${currencySymbol}${data.total} ${currencyCode}

Payment Method: ${paymentMethodStr}
Shipping Address:
${shippingAddressStr}

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
