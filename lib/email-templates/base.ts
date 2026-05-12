export function baseTemplate(content: string, preheader: string = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zica Bella</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #000000; padding: 28px 40px; text-align: center; }
    .header img { height: 36px; }
    .header-text { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; }
    .body { padding: 40px; color: #1a1a1a; font-size: 15px; line-height: 1.7; }
    .cta-btn { display: inline-block; background: #000000; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 4px; font-size: 14px; font-weight: 600; letter-spacing: 1px; margin: 20px 0; text-transform: uppercase; }
    .divider { border: none; border-top: 1px solid #eaeaea; margin: 28px 0; }
    .footer { background: #f9f9f9; padding: 28px 40px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eaeaea; }
    .footer a { color: #888888; text-decoration: underline; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .badge-confirmed { background: #e6f4ea; color: #1e7e34; }
    .badge-shipped { background: #e8f0fe; color: #1a56db; }
    .badge-delivered { background: #fef9e7; color: #b45309; }
    .badge-cancelled { background: #fdecea; color: #c62828; }
    .badge-pending { background: #f3f4f6; color: #374151; }
    .info-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .info-table td { padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .info-table td:first-child { color: #888888; width: 40%; }
    .info-table td:last-child { font-weight: 500; }
    .product-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .highlight-box { background: #f9f9f9; border-left: 3px solid #000000; padding: 16px 20px; border-radius: 0 4px 4px 0; margin: 20px 0; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="wrapper">
    <div class="header">
      <div class="header-text">ZICA BELLA</div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Zica Bella. All rights reserved.</p>
      <p>
        <a href="https://zicabella.com">Website</a> &nbsp;·&nbsp;
        <a href="https://zicabella.com/privacy">Privacy Policy</a> &nbsp;·&nbsp;
        <a href="https://zicabella.com/contact">Contact Us</a>
      </p>
      <p style="margin-top: 8px;">Zica Bella, New Delhi, India</p>
      <p><a href="{{unsubscribe_link}}">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `;
}
