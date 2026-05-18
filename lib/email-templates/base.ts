/**
 * Zica Bella Premium Apple-Level Glassmorphic Theme Layouts for Emails
 */

export function baseTemplate(content: string, preheader: string = '') {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zica Bella</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    @font-face {
      font-family: 'Rocaston';
      src: url('https://cdn.shopify.com/s/files/1/0955/5394/5881/files/Rocaston.ttf?v=1758543424') format('truetype');
      font-weight: normal;
      font-style: normal;
    }

    body { 
      margin: 0; 
      padding: 0; 
      background-color: #08080a; 
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #e5e5ea;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper { 
      max-width: 580px; 
      margin: 40px auto; 
      background: #121216; 
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 40px 80px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .header { 
      background: #000000; 
      padding: 40px 30px; 
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .header-text { 
      color: #C9A96E; 
      font-family: 'Rocaston', -apple-system, sans-serif;
      font-size: 26px; 
      font-weight: normal; 
      letter-spacing: 10px; 
      text-transform: uppercase; 
      margin: 0;
      text-shadow: 0 4px 20px rgba(201, 169, 110, 0.15);
    }
    .body { 
      padding: 45px 40px; 
      color: #aeaeae; 
      font-size: 13px; 
      line-height: 1.7; 
    }
    .body h1, .body h2, .body h3 {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
      color: #ffffff;
      font-weight: 600;
      margin-top: 0;
      letter-spacing: -0.02em;
    }
    .body h1 { 
      font-size: 19px; 
      margin-bottom: 24px; 
      text-align: center; 
      text-transform: uppercase; 
      border-bottom: 1px solid rgba(255, 255, 255, 0.05); 
      padding-bottom: 20px; 
      color: #C9A96E;
      letter-spacing: 2px;
    }
    .body h2 { 
      font-size: 15px; 
      margin-bottom: 18px; 
      color: #ffffff;
    }
    .body h3 { 
      font-size: 11px; 
      margin-bottom: 14px; 
      text-transform: uppercase; 
      letter-spacing: 1.5px; 
      color: rgba(255, 255, 255, 0.4);
    }
    
    .cta-btn { 
      display: inline-block; 
      background: #ffffff; 
      color: #000000 !important; 
      text-decoration: none; 
      padding: 14px 32px; 
      border-radius: 8px; 
      font-size: 11px; 
      font-weight: 600; 
      letter-spacing: 0.5px; 
      margin: 20px 0; 
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
      border: 1px solid #ffffff;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .divider { 
      border: none; 
      border-top: 1px solid rgba(255, 255, 255, 0.06); 
      margin: 25px 0; 
    }
    .footer { 
      background: #09090b; 
      padding: 35px; 
      text-align: center; 
      font-size: 10px; 
      color: #55555d; 
      border-top: 1px solid rgba(255, 255, 255, 0.04); 
      line-height: 1.6;
    }
    .footer a { 
      color: #8e8e93; 
      text-decoration: none; 
    }
    .footer a:hover {
      color: #ffffff;
      text-decoration: underline;
    }
    
    .glass-box { 
      background: rgba(255, 255, 255, 0.02); 
      border: 1px solid rgba(255, 255, 255, 0.06); 
      padding: 20px 24px; 
      border-radius: 12px; 
      margin: 20px 0; 
      line-height: 1.7;
    }
    
    .info-table { 
      width: 100%; 
      border-collapse: collapse; 
      font-size: 12px; 
    }
    .info-table td { 
      padding: 10px 0; 
      border-bottom: 1px solid rgba(255, 255, 255, 0.04); 
    }
    .info-table td:first-child { 
      color: rgba(255, 255, 255, 0.4); 
    }
    .info-table td:last-child { 
      font-weight: 500; 
      color: #ffffff;
      text-align: right;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-confirmed { background: rgba(52, 199, 89, 0.12); color: #30d158; border: 1px solid rgba(48, 209, 88, 0.2); }
    .badge-shipped { background: rgba(10, 132, 255, 0.12); color: #0a84ff; border: 1px solid rgba(10, 132, 255, 0.2); }
    .badge-failed { background: rgba(255, 69, 58, 0.12); color: #ff453a; border: 1px solid rgba(255, 69, 58, 0.2); }
    
    @media only screen and (max-width: 600px) {
      .wrapper { margin: 0 auto; border-radius: 0px; width: 100% !important; }
      .body { padding: 35px 20px !important; }
      .header { padding: 35px 20px !important; }
    }
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
      <p style="margin: 0 0 8px 0; color: #C9A96E; font-family: 'Rocaston', -apple-system, sans-serif; font-size: 13px; letter-spacing: 4px;">© ZICA BELLA</p>
      <p style="margin: 0 0 15px 0; color: #44444a;">Faridabad, Haryana | developer@zicabella.com</p>
      <p style="margin: 0; font-size: 9px; letter-spacing: 0.2px;">
        <a href="https://app.zicabella.com">Website</a> &nbsp;·&nbsp;
        <a href="https://app.zicabella.com/policies/privacy-policy">Privacy Policy</a> &nbsp;·&nbsp;
        <a href="https://app.zicabella.com/policies/contact-information">Contact Us</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Zica Bella Premium Apple-Level Glassmorphic Theme Layout for Zoho Mail Integration
 */
export function baseEmailLayout(content: string, previewText?: string): string {
  const currentYear = new Date().getFullYear();
  const previewSpan = previewText 
    ? `<span style="display:none; max-height:0px; max-width:0px; opacity:0; overflow:hidden; mso-hide:all; font-size:0px; line-height:0px;">${previewText}</span>` 
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zica Bella</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    @font-face {
      font-family: 'Rocaston';
      src: url('https://cdn.shopify.com/s/files/1/0955/5394/5881/files/Rocaston.ttf?v=1758543424') format('truetype');
      font-weight: normal;
      font-style: normal;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: #08080a;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0px !important;
      }
      .content {
        padding: 35px 20px !important;
      }
      .cta-button {
        display: block !important;
        width: auto !important;
        text-align: center !important;
        margin: 20px 0 !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 40px 0; background-color: #08080a; color: #e5e5ea;">
  ${previewSpan}
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #08080a; padding: 20px 0;">
    <tr>
      <td align="center">
        <!-- Main Content Area (Apple Glass Obsidian Card) -->
        <table border="0" cellpadding="0" cellspacing="0" width="580" class="container" style="background: #121216; border-radius: 18px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255, 255, 255, 0.08); border-collapse: collapse; border: 1px solid rgba(255, 255, 255, 0.08);">
          
          <!-- Header (Pure Black with Gold logo text) -->
          <tr>
            <td align="center" style="padding: 40px 20px; background-color: #000000; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <h1 style="margin: 0; font-family: 'Rocaston', -apple-system, sans-serif; font-size: 26px; font-weight: normal; letter-spacing: 10px; color: #C9A96E; text-transform: uppercase; text-shadow: 0 4px 20px rgba(201, 169, 110, 0.15);">
                ZICA BELLA
              </h1>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td class="content" style="padding: 45px 40px; color: #aeaeae; font-size: 13px; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
              ${content}
            </td>
          </tr>

          <!-- Footer (Pure Black with Gold accents) -->
          <tr>
            <td align="center" style="padding: 35px 20px; background-color: #09090b; color: #55555d; font-size: 10px; line-height: 1.6; border-top: 1px solid rgba(255, 255, 255, 0.04); font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
              <p style="margin: 0 0 10px 0; color: #C9A96E; font-weight: normal; font-family: 'Rocaston', -apple-system, sans-serif; font-size: 13px; letter-spacing: 4px;">
                © ZICA BELLA
              </p>
              <p style="margin: 0 0 15px 0; color: #44444a;">
                developer@zicabella.com | Faridabad, Haryana
              </p>
              <p style="margin: 0; font-size: 9px; color: #333339; letter-spacing: 0.2px;">
                This communication is intended solely for registered users of Zica Bella.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
