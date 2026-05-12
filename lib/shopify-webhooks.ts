import crypto from 'crypto';

export function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  if (!process.env.SHOPIFY_WEBHOOK_SECRET) {
    console.error('SHOPIFY_WEBHOOK_SECRET is not set');
    return false;
  }
  
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');
  
  return hash === hmacHeader;
}

// Register webhooks with Shopify Admin API
export async function registerWebhooks() {
  const webhooks = [
    { topic: 'orders/create', address: 'https://app.zicabella.com/api/email/order-confirmation' },
    { topic: 'orders/cancelled', address: 'https://app.zicabella.com/api/email/order-cancelled' },
    { topic: 'orders/fulfilled', address: 'https://app.zicabella.com/api/email/order-shipped' },
  ];
  
  // Implementation for registering each via Shopify Admin REST API
  // This would typically be called once during app installation or setup
  console.log('Registering webhooks:', webhooks);
}
