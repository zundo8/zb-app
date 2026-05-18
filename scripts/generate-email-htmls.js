const fs = require('fs');
const path = require('path');

const templates = [
  { file: 'welcome.html', title: 'Welcome to Zica Bella', type: 'transactional' },
  { file: 'order-confirmation.html', title: 'Your order #{{orderId}} is confirmed', type: 'transactional' },
  { file: 'order-shipped.html', title: 'Your order is on its way', type: 'transactional' },
  { file: 'payment-failed.html', title: 'Action required - payment unsuccessful', type: 'transactional' },
  { file: 'order-cancelled.html', title: 'Your order has been cancelled', type: 'transactional' },
  { file: 'order-delivered.html', title: 'Your order has arrived', type: 'transactional' },
  { file: 'return-refund.html', title: 'Your return has been accepted', type: 'transactional' },
  { file: 'new-drop.html', title: '{{collectionName}} - Members Only Drop', type: 'marketing' },
  { file: 'password-reset.html', title: 'Reset your Zica Bella password', type: 'transactional' }
];

const templateDir = path.join(__dirname, '..', 'lib', 'email-templates');

const makeHtml = (t) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');
  body {
    background-color: #ffffff;
    color: #000000;
    font-family: 'DM Mono', monospace;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .header {
    text-align: center;
    margin-bottom: 40px;
    border-bottom: 2px solid #000000;
    padding-bottom: 20px;
  }
  .wordmark {
    font-family: 'DM Serif Display', serif;
    font-size: 32px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  h1 {
    font-family: 'DM Serif Display', serif;
    font-size: 28px;
    font-weight: normal;
    margin-bottom: 20px;
  }
  p {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 20px;
  }
  .footer {
    margin-top: 60px;
    border-top: 1px solid #eeeeee;
    padding-top: 20px;
    font-size: 12px;
    text-align: center;
    color: #888888;
  }
  .btn {
    display: inline-block;
    background-color: #000000;
    color: #ffffff;
    padding: 12px 24px;
    text-decoration: none;
    text-transform: uppercase;
    font-size: 13px;
    letter-spacing: 1px;
    margin-top: 20px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="wordmark">ROCASTON</div>
      <div style="margin-top: 10px; font-size: 12px; letter-spacing: 1px;">ZICA BELLA</div>
    </div>
    
    <h1>${t.title}</h1>
    
    <p>Dear ${t.file.includes('new-drop') ? '{{customerName}}' : 'Customer'},</p>
    
    <p>This is the ${t.title} template.</p>
    
    ${t.file === 'new-drop.html' ? `
    <div style="margin: 30px 0;">
      <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80" alt="Image 1 - Hero" style="width: 100%; height: auto; display: block; border: 1px solid #000;" />
    </div>
    <p>Discover our new {{collectionName}} collection, dropping on {{dropDate}}.</p>
    <div style="margin: 30px 0;">
      <img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80" alt="Image 2 - Product" style="width: 100%; height: auto; display: block; border: 1px solid #000;" />
    </div>
    <a href="{{shopUrl}}" class="btn">Shop Now</a>
    ` : ''}

    ${t.file === 'order-confirmation.html' ? `
    <p>We are preparing your order #{{orderId}}.</p>
    <a href="{{orderStatusUrl}}" class="btn">View Order</a>
    ` : ''}
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Zica Bella. All rights reserved.</p>
      <p>If you have any questions, reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

templates.forEach(t => {
  const p = path.join(templateDir, t.file);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, makeHtml(t), 'utf8');
    console.log('Created ' + t.file);
  }
});
