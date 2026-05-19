const fs = require('fs');

const baseHtml = (title, headerText, heroMain, heroItalic, bodyTextHtml, itemsSection = true, noticeSectionHtml = '', ctaHtml = '', footerText = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zica Bella — ${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400&display=swap');
    @font-face {
      font-family: 'Rocaston';
      src: url('https://cdn.shopify.com/s/files/1/0955/5394/5881/files/Rocaston.ttf?v=1758543424') format('truetype');
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background-color: #000; font-family: 'DM Mono', 'Courier New', monospace; -webkit-font-smoothing: antialiased; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
      .pad { padding: 36px 22px !important; }
      .hero-txt { font-size: 50px !important; }
      .item-img { display: none !important; }
    }
  </style>
</head>
<body>
<div style="display:none; max-height:0; overflow:hidden; font-size:0; opacity:0;">${title}</div>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#000; padding:48px 20px;">
  <tr><td align="center">
    <table border="0" cellpadding="0" cellspacing="0" width="580" class="container" style="background:#0a0a0a; border-radius:2px; border:1px solid rgba(255,255,255,0.12);">

      <tr><td style="height:3px; background:#e5e5e5; border-radius:2px 2px 0 0;"></td></tr>

      <tr><td class="pad" style="padding:36px 48px 28px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td><p style="margin:0; font-family:'Rocaston',serif; font-size:11px; letter-spacing:8px; color:#fff; text-transform:uppercase; opacity:.9;">ZICA BELLA</p></td>
            <td align="right"><p style="margin:0; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.6); text-transform:uppercase;">${headerText}</p></td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 48px;"><div style="height:1px; background:rgba(255,255,255,0.08);"></div></td></tr>

      <tr><td class="pad" style="padding:52px 48px 0;">
        <h1 class="hero-txt" style="margin:0; font-family:'DM Serif Display',Georgia,serif; font-size:60px; font-weight:400; line-height:1.0; color:#fff; letter-spacing:-1px;">
          ${heroMain}<br><em style="font-style:italic; color:rgba(255,255,255,0.35); font-size:42px;">${heroItalic}</em>
        </h1>
      </td></tr>

      <tr><td class="pad" style="padding:36px 48px 0;">
        <p style="margin:0 0 14px; font-family:'DM Mono',monospace; font-size:12px; font-weight:300; line-height:1.9; color:rgba(255,255,255,0.55);">Dear {{customerName}},</p>
        <div style="font-family:'DM Mono',monospace; font-size:12px; font-weight:300; line-height:1.9; color:rgba(255,255,255,0.55);">
          ${bodyTextHtml}
        </div>
      </td></tr>

      ${itemsSection ? `
      <tr><td class="pad" style="padding:32px 48px 0;">
        {{itemsHtml}}
        <div style="text-align: right; margin-top: 15px;">
            <p style="margin:0; font-family:'DM Mono',monospace; font-size:14px; color:rgba(255,255,255,0.8);">Total: {{totalPrice}}</p>
        </div>
      </td></tr>
      ` : ''}

      ${noticeSectionHtml ? `
      <tr><td class="pad" style="padding:24px 48px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-left:2px solid rgba(255,255,255,0.2);">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0; font-family:'DM Mono',monospace; font-size:11px; font-weight:300; line-height:1.8; color:rgba(255,255,255,0.45);">
              ${noticeSectionHtml}
            </p>
          </td></tr>
        </table>
      </td></tr>
      ` : ''}

      ${ctaHtml ? `
      <tr><td class="pad" style="padding:36px 48px 0;">
        ${ctaHtml}
      </td></tr>
      ` : ''}

      <tr><td class="pad" style="padding:36px 48px 48px;">
        <p style="margin:0; font-family:'DM Mono',monospace; font-size:11px; font-weight:300; line-height:1.9; color:rgba(255,255,255,0.28);">
          ${footerText}
        </p>
      </td></tr>

      <tr><td style="padding:0 48px;"><div style="height:1px; background:rgba(255,255,255,0.06);"></div></td></tr>

      <tr><td class="pad" style="padding:28px 48px 36px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td><p style="margin:0; font-family:'Rocaston',serif; font-size:9px; letter-spacing:5px; color:rgba(255,255,255,0.2); text-transform:uppercase;">ZICA BELLA</p></td>
            <td align="right"><p style="margin:0; font-family:'DM Mono',monospace; font-size:9px; color:rgba(255,255,255,0.18);">India</p></td>
          </tr>
        </table>
        <p style="margin:16px 0 0; font-family:'DM Mono',monospace; font-size:9px; color:rgba(255,255,255,0.12); line-height:1.7;">
          Sent to {{customerEmail}} · Notification from Zica Bella.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

const orderConfirmation = baseHtml(
    "Order Confirmation",
    "Order Confirmed",
    "Order",
    "confirmed.",
    `<p style="margin:0;">Thank you for shopping with us. Your order #{{orderId}} is confirmed and we are getting it ready. You will receive another notification when it ships.</p>`,
    true,
    '',
    `<a href="{{orderStatusUrl}}" style="display:inline-block; background:#fff; color:#000; text-decoration:none; padding:15px 36px; font-family:'DM Mono',monospace; font-size:10px; font-weight:400; letter-spacing:2.5px; text-transform:uppercase; border-radius:1px;">View Order Status →</a>`,
    "If you have any questions about your order, reply to this email and our team will assist you directly."
);

const orderShipped = baseHtml(
    "Order Shipped",
    "Order Shipped",
    "Order",
    "on its way.",
    `<p style="margin:0;">Great news! Your order #{{orderId}} has been shipped and is heading to you.</p>`,
    true,
    `It may take up to 24 hours for the tracking information to update on the carrier's website.`,
    `<a href="{{trackingUrl}}" style="display:inline-block; background:#fff; color:#000; text-decoration:none; padding:15px 36px; font-family:'DM Mono',monospace; font-size:10px; font-weight:400; letter-spacing:2.5px; text-transform:uppercase; border-radius:1px;">Track Package →</a>`,
    "If you have any questions about your shipment, reply to this email and our team will assist you."
);

const orderDelivered = baseHtml(
    "Order Delivered",
    "Order Delivered",
    "Order",
    "arrived.",
    `<p style="margin:0;">Your Zica Bella order #{{orderId}} has been delivered. We hope you love your new items!</p>`,
    true,
    '',
    `<p style="margin:0 0 20px; font-family:'DM Mono',monospace; font-size:12px; font-weight:300; line-height:1.9; color:rgba(255,255,255,0.55);">How was your experience? We'd love to hear your thoughts.</p><a href="https://zicabella.com/reviews" style="display:inline-block; background:#fff; color:#000; text-decoration:none; padding:15px 36px; font-family:'DM Mono',monospace; font-size:10px; font-weight:400; letter-spacing:2.5px; text-transform:uppercase; border-radius:1px;">Leave a Review →</a>`,
    "Tag us in your photos @zicabella for a chance to be featured!"
);

const orderCancelled = baseHtml(
    "Order Cancelled",
    "Order Cancelled",
    "Order",
    "cancelled.",
    `<p style="margin:0;">We're writing to let you know that your order #{{orderId}} has been successfully cancelled.</p>`,
    true,
    `If you have already paid for this order, the refund process has been initiated and should reflect in your account shortly based on your payment method.`,
    `<a href="https://zicabella.com" style="display:inline-block; background:#fff; color:#000; text-decoration:none; padding:15px 36px; font-family:'DM Mono',monospace; font-size:10px; font-weight:400; letter-spacing:2.5px; text-transform:uppercase; border-radius:1px;">Continue Shopping →</a>`,
    "If you have any questions regarding this cancellation, reply to this email."
);

const passwordReset = baseHtml(
    "Reset Password",
    "Password Reset",
    "Reset",
    "your password.",
    `<p style="margin:0;">We received a request to reset your password for your Zica Bella account. Click the button below to set a new password.</p>`,
    false,
    `This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.`,
    `<a href="{{resetUrl}}" style="display:inline-block; background:#fff; color:#000; text-decoration:none; padding:15px 36px; font-family:'DM Mono',monospace; font-size:10px; font-weight:400; letter-spacing:2.5px; text-transform:uppercase; border-radius:1px;">Reset Password →</a>`,
    "If you have any questions, reply to this email."
);

const welcome = baseHtml(
    "Welcome to Zica Bella",
    "Welcome",
    "Welcome to",
    "Zica Bella.",
    `<p style="margin:0 0 14px;">Welcome to the Zica Bella community! We're thrilled to have you with us.</p><p style="margin:0;">Zica Bella is more than just clothing; it's a movement. Explore our latest collections and find your unique style. Use code <strong>WELCOME10</strong> for 10% off your first order.</p>`,
    false,
    '',
    `<a href="https://zicabella.com" style="display:inline-block; background:#fff; color:#000; text-decoration:none; padding:15px 36px; font-family:'DM Mono',monospace; font-size:10px; font-weight:400; letter-spacing:2.5px; text-transform:uppercase; border-radius:1px;">Start Exploring →</a>`,
    "If you have any questions, reply to this email."
);

fs.writeFileSync('lib/email-templates/order-confirmation.html', orderConfirmation);
fs.writeFileSync('lib/email-templates/order-shipped.html', orderShipped);
fs.writeFileSync('lib/email-templates/order-delivered.html', orderDelivered);
fs.writeFileSync('lib/email-templates/order-cancelled.html', orderCancelled);
fs.writeFileSync('lib/email-templates/password-reset.html', passwordReset);
fs.writeFileSync('lib/email-templates/welcome.html', welcome);

console.log("Updated templates successfully.");
