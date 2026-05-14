import { NextResponse } from 'next/server';
import { getShopConfig } from '@/lib/shopify-client';

export const dynamic = 'force-dynamic';

const API_VERSION = '2025-07';

// Server-side Shopify Storefront API call using the token stored in the database
async function storefrontFetch(query: string, variables?: Record<string, unknown>) {
  const config = await getShopConfig();
  // Use the storefront token from env (not admin token) for cart operations
  const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  const domain = config.domain;

  const url = `https://${domain}/api/${API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken || '',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Storefront API ${response.status}: ${text}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join(', '));
  }
  return json.data;
}

// Cart mutations
const CREATE_CART = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title handle featuredImage { url } } } } } } }
        cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

const ADD_TO_CART = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title handle featuredImage { url } } } } } } }
        cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

const REMOVE_FROM_CART = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id lines(first: 50) { edges { node { id quantity } } } }
      userErrors { field message }
    }
  }
`;

const UPDATE_CART_LINE = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 50) { edges { node { id quantity } } }
        cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

const GET_CART = `
  query getCart($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title handle featuredImage { url } } } } } } }
      cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
    }
  }
`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cartId = url.searchParams.get('cartId');

    if (!cartId || cartId === 'health-check' || cartId === 'test' || cartId === 'null') {
      return NextResponse.json({ 
        cart: { id: 'gid://shopify/Cart/test', lines: { edges: [] }, cost: { totalAmount: { amount: '0', currencyCode: 'INR' } } },
        isTest: true
      }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await storefrontFetch(GET_CART, { cartId });
    return NextResponse.json({ cart: data.cart }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error: any) {
    console.error('[App API] Cart GET error:', error.message);
    return NextResponse.json(
      { cart: null, error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action || 'create';

    let data;
    switch (action) {
      case 'create':
        data = await storefrontFetch(CREATE_CART, { input: body.input || { lines: [] } });
        return NextResponse.json({ cart: data.cartCreate?.cart, errors: data.cartCreate?.userErrors }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });

      case 'addLines':
        data = await storefrontFetch(ADD_TO_CART, { cartId: body.cartId, lines: body.lines });
        return NextResponse.json({ cart: data.cartLinesAdd?.cart, errors: data.cartLinesAdd?.userErrors }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });

      case 'removeLines':
        data = await storefrontFetch(REMOVE_FROM_CART, { cartId: body.cartId, lineIds: body.lineIds });
        return NextResponse.json({ cart: data.cartLinesRemove?.cart, errors: data.cartLinesRemove?.userErrors }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });

      case 'updateLines':
        data = await storefrontFetch(UPDATE_CART_LINE, { cartId: body.cartId, lines: body.lines });
        return NextResponse.json({ cart: data.cartLinesUpdate?.cart, errors: data.cartLinesUpdate?.userErrors }, {
          headers: { 'Access-Control-Allow-Origin': '*' },
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use create, addLines, removeLines, or updateLines.` },
          { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
  } catch (error: any) {
    console.error('[App API] Cart POST error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
