// lib/services/shopifyPayments.ts
import prisma from '@/lib/db';
import { API_VERSION } from '@/lib/shopify-client';

export async function createDraftOrderForExchange(exchangeId: string) {
  try {
    const exchange = await prisma.exchange.findUnique({
      where: { id: exchangeId },
      include: { 
        order: { include: { shop: true, customer: true } },
        newProduct: true 
      }
    });

    if (!exchange) throw new Error('Exchange not found');
    
    const shopDomain = exchange.order.shop.domain;
    const accessToken = exchange.order.shop.accessToken; // Assumes offline/admin token

    if (exchange.priceDifference <= 0) {
      return { success: true, message: 'No payment needed' };
    }

    // Mock API Call to Shopify REST or GraphQL DraftOrderCreate
    if (!accessToken || accessToken.startsWith('mock_')) {
      console.warn(`[Shopify Mock] Creating Draft Order for ${shopDomain} - Diff: ₹${exchange.priceDifference}`);
      
      const draftOrderUrl = `https://${shopDomain}/admin/draft_orders/mocked_123.json`;
      
      // We would email the draft order link to the customer here
      console.log(`[Shopify Mock] Customer invoice URL: ${draftOrderUrl}`);

      return {
        success: true,
        draftOrderId: 'mock_draft_123',
        invoiceUrl: draftOrderUrl
      };
    }

    // Real Shopify Admin API call
    const query = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            invoiceUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lineItems: [
          {
            variantId: 'gid://shopify/ProductVariant/DUMMY', // normally the newProduct variant
            quantity: 1,
            originalUnitPrice: String(exchange.priceDifference)
          }
        ],
        customer: {
          id: `gid://shopify/Customer/${exchange.order.customer.shopifyId}`
        },
        useCustomerDefaultAddress: true,
      }
    };

    const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error('Shopify Draft Order Error:', error.message);
    throw error;
  }
}
