import { baseEmailLayout } from './base';
import { OrderEmailData } from './orderPlaced';

export function orderDeliveredEmail(data: OrderEmailData): { subject: string; html: string; text: string } {
  const firstName = data.customerName.split(' ')[0] || data.customerName;
  const subject = `Delivered! Your Zica Bella order #${data.orderId} has arrived 🎉`;
  const deliveryDateStr = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });

  // HTML Content
  const htmlContent = `
    <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 300; color: #000000; margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #C9A96E; padding-bottom: 10px;">
      Your order has been delivered
    </h2>
    
    <p style="margin: 0 0 20px 0;">Hi ${firstName},</p>
    
    <p style="margin: 0 0 20px 0;">
      Our delivery partner confirms that your Zica Bella package <strong>#${data.orderId}</strong> has been delivered today, <strong>${deliveryDateStr}</strong>.
    </p>

    <div style="background-color: #fcfbf9; border-left: 3px solid #C9A96E; padding: 20px; margin: 25px 0; border-radius: 0 4px 4px 0; text-align: center;">
      <span style="font-size: 32px;">🎁</span>
      <h3 style="margin: 10px 0 5px 0; font-family: Georgia, serif; color: #000000; font-weight: normal;">We hope you love every piece.</h3>
      <p style="margin: 0; font-size: 14px; color: #666666;">Each outfit is crafted with precision to elevate your personal style.</p>
    </div>

    <p style="margin: 0 0 20px 0;">
      Your experience means the world to us. We would love to hear your thoughts about the fit, quality, and design of your new garments.
    </p>

    <div style="text-align: center; margin: 35px 0;">
      <a href="https://zicabella.com/reviews/new?orderId=${data.orderId}" style="display: inline-block; background-color: #C9A96E; color: #000000; text-decoration: none; padding: 14px 35px; border-radius: 4px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; box-shadow: 0 4px 12px rgba(201, 169, 110, 0.3);">
        Share Your Feedback
      </a>
    </div>

    <p style="margin: 0 0 5px 0; font-style: italic; color: #555555; text-align: center;">
      Warmly,
    </p>
    <p style="margin: 0; color: #888888; text-align: center; font-size: 13px;">
      The Zica Bella Team
    </p>
  `;

  // Plain-Text Fallback
  const textContent = `
Your order has been delivered!
Hi ${firstName},

Our delivery partner confirms that your Zica Bella order #${data.orderId} was delivered on ${deliveryDateStr}.

We hope you love every piece. Each outfit is crafted with precision to elevate your personal style.

Your experience means the world to us. Please share your feedback and review your items here:
https://zicabella.com/reviews/new?orderId=${data.orderId}

Warmly,
The Zica Bella Team
  `.trim();

  return {
    subject,
    html: baseEmailLayout(htmlContent, `Order #${data.orderId} Delivered`),
    text: textContent,
  };
}
