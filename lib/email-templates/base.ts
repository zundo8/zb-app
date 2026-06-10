/**
 * Zica Bella Premium Apple-Level Glassmorphic Theme Layouts for Emails
 */

function inlineStyles(content: string): string {
  return content
    // Replace custom classes with robust inline styles
    .replaceAll('class="wrapper"', 'style="max-width: 580px; margin: 40px auto; background-color: #121216; border-radius: 18px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', sans-serif;"')
    .replaceAll('class="container"', 'style="max-width: 580px; margin: 40px auto; background-color: #121216; border-radius: 18px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', sans-serif;"')
    .replaceAll('class="header"', 'style="background-color: #000000; padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);"')
    .replaceAll('class="header-text"', 'style="color: #C9A96E; font-family: \'Rocaston\', -apple-system, sans-serif; font-size: 26px; font-weight: normal; letter-spacing: 10px; text-transform: uppercase; margin: 0; text-shadow: 0 4px 20px rgba(201, 169, 110, 0.15);"')
    .replaceAll('class="body"', 'style="padding: 45px 40px; color: #aeaeae; font-size: 13px; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, sans-serif;"')
    .replaceAll('class="content"', 'style="padding: 45px 40px; color: #aeaeae; font-size: 13px; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, sans-serif;"')
    .replaceAll('class="footer"', 'style="background-color: #09090b; padding: 35px; text-align: center; font-size: 10px; color: #55555d; border-top: 1px solid rgba(255, 255, 255, 0.04); line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, sans-serif;"')
    
    // Core custom component classes
    .replaceAll('class="glass-box"', 'style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); padding: 20px 24px; border-radius: 12px; margin: 20px 0; line-height: 1.7; color: #aeaeae;"')
    .replaceAll('class="highlight-box"', 'style="background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); padding: 20px 24px; border-radius: 12px; margin: 20px 0; line-height: 1.7; color: #aeaeae;"')
    .replaceAll('class="cta-btn"', 'style="display: inline-block; background-color: #ffffff; color: #000000 !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; margin: 20px 0; text-transform: uppercase; border: 1px solid #ffffff; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);"')
    .replaceAll('class="cta-button"', 'style="display: inline-block; background-color: #ffffff; color: #000000 !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; margin: 20px 0; text-transform: uppercase; border: 1px solid #ffffff; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);"')
    .replaceAll('class="product-row"', 'style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04);"')
    .replaceAll('class="info-table"', 'style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px;"')
    
    // Status Badges
    .replaceAll('class="badge badge-confirmed"', 'style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background-color: rgba(52, 199, 89, 0.12); color: #30d158; border: 1px solid rgba(48, 209, 88, 0.2);"')
    .replaceAll('class="status-badge badge-confirmed"', 'style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background-color: rgba(52, 199, 89, 0.12); color: #30d158; border: 1px solid rgba(48, 209, 88, 0.2);"')
    .replaceAll('class="status-badge badge-shipped"', 'style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background-color: rgba(10, 132, 255, 0.12); color: #0a84ff; border: 1px solid rgba(10, 132, 255, 0.2);"')
    .replaceAll('class="status-badge badge-cancelled"', 'style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background-color: rgba(255, 69, 58, 0.12); color: #ff453a; border: 1px solid rgba(255, 69, 58, 0.2);"')
    .replaceAll('class="status-badge badge-failed"', 'style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background-color: rgba(255, 69, 58, 0.12); color: #ff453a; border: 1px solid rgba(255, 69, 58, 0.2);"')
    .replaceAll('class="status-badge badge-delivered"', 'style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background-color: rgba(52, 199, 89, 0.12); color: #30d158; border: 1px solid rgba(48, 209, 88, 0.2);"')
    
    // Standard elements style replacements inside content block
    .replace(/<h1>/g, '<h1 style="font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', sans-serif; color: #C9A96E; font-size: 19px; font-weight: 600; margin-top: 0; margin-bottom: 24px; text-align: center; text-transform: uppercase; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 20px; letter-spacing: 2px;">')
    .replace(/<h2>/g, '<h2 style="font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', sans-serif; color: #ffffff; font-size: 15px; font-weight: 600; margin-top: 0; margin-bottom: 18px; letter-spacing: -0.02em;">')
    .replace(/<h3>/g, '<h3 style="font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', sans-serif; color: rgba(255, 255, 255, 0.4); font-size: 11px; font-weight: 600; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1.5px;">')
    .replace(/<p>/g, '<p style="margin-top: 0; margin-bottom: 16px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; line-height: 1.7; color: #aeaeae;">')
    .replace(/<li>/g, '<li style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; line-height: 1.7; color: #aeaeae; margin-bottom: 6px;">')
    .replace(/<hr\s*\/?>/g, '<hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.06); margin: 25px 0;" />')
    
    // Clean up empty classes
    .replaceAll('class=""', '');
}

export function baseTemplate(content: string, preheader: string = '') {
  const currentYear = new Date().getFullYear();
  const rawHtml = `<!DOCTYPE html>
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
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
      color: #e5e5ea;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #08080a; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="background-color: #08080a; padding: 40px 10px; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
    <div class="wrapper">
      <div class="header">
        <div class="header-text">ZICA BELLA</div>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px 0; color: #C9A96E; font-family: 'Rocaston', -apple-system, sans-serif; font-size: 13px; letter-spacing: 4px; text-transform: uppercase;">© ZICA BELLA</p>
        <p style="margin: 0 0 15px 0; color: #44444a;">Faridabad, Haryana | developer@zicabella.com</p>
        <p style="margin: 0; font-size: 9px; letter-spacing: 0.2px;">
          <a href="https://zicabella.com" style="color: #8e8e93; text-decoration: none;">Website</a> &nbsp;·&nbsp;
          <a href="https://zicabella.com/policies/privacy-policy" style="color: #8e8e93; text-decoration: none;">Privacy Policy</a> &nbsp;·&nbsp;
          <a href="https://zicabella.com/policies/contact-information" style="color: #8e8e93; text-decoration: none;">Contact Us</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return inlineStyles(rawHtml);
}

/**
 * Zica Bella Premium Apple-Level Glassmorphic Theme Layout for Zoho Mail Integration
 */
export function baseEmailLayout(content: string, previewText?: string): string {
  const currentYear = new Date().getFullYear();
  const previewSpan = previewText 
    ? `<span style="display:none; max-height:0px; max-width:0px; opacity:0; overflow:hidden; mso-hide:all; font-size:0px; line-height:0px;">${previewText}</span>` 
    : '';

  const rawHtml = `<!DOCTYPE html>
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
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #08080a; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
  <div style="background-color: #08080a; padding: 40px 10px; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
    ${previewSpan}
    <div class="container">
      <div class="header">
        <div class="header-text">ZICA BELLA</div>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p style="margin: 0 0 10px 0; color: #C9A96E; font-weight: normal; font-family: 'Rocaston', -apple-system, sans-serif; font-size: 13px; letter-spacing: 4px; text-transform: uppercase;">
          © ZICA BELLA
        </p>
        <p style="margin: 0 0 15px 0; color: #44444a;">
          developer@zicabella.com | Faridabad, Haryana
        </p>
        <p style="margin: 0; font-size: 9px; color: #333339; letter-spacing: 0.2px;">
          This communication is intended solely for registered users of Zica Bella.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return inlineStyles(rawHtml);
}
