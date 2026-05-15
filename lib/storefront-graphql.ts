import { shopifyStorefrontFetch } from './shopify-storefront';

export const STOREFRONT_QUERIES = {
  collections: `
    query getCollections($first: Int!) {
      collections(first: $first) {
        edges {
          node {
            id
            handle
            title
            image { url }
            productsCount: products(first: 0) { totalCount }
          }
        }
      }
    }
  `,
  collectionProducts: `
    query getCollectionProducts($handle: String!, $first: Int!, $cursor: String) {
      collection(handle: $handle) {
        products(first: $first, after: $cursor) {
          pageInfo { hasNextPage, endCursor }
          edges {
            node {
              id
              handle
              title
              availableForSale
              featuredImage { url altText }
              priceRange {
                minVariantPrice { amount currencyCode }
              }
            }
          }
        }
      }
    }
  `,
  productByHandle: `
    query getProduct($handle: String!) {
      product(handle: $handle) {
        id
        handle
        title
        description
        descriptionHtml
        availableForSale
        tags
        priceRange { minVariantPrice { amount currencyCode } }
        featuredImage { url altText }
        images(first: 10) { edges { node { url altText } } }
        variants(first: 10) {
          edges {
            node {
              id
              title
              availableForSale
              quantityAvailable
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              selectedOptions { name value }
            }
          }
        }
      }
    }
  `,
  search: `
    query searchProducts($query: String!, $first: Int!) {
      search(query: $query, first: $first, types: PRODUCT) {
        edges {
          node {
            ... on Product {
              id
              handle
              title
              availableForSale
              featuredImage { url altText }
              priceRange {
                minVariantPrice { amount currencyCode }
              }
            }
          }
        }
      }
    }
  `,
  products: `
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            handle
            title
            availableForSale
            featuredImage { url altText }
            priceRange {
              minVariantPrice { amount currencyCode }
            }
          }
        }
      }
    }
  `
};

export async function fetchProducts(limit: number = 24) {
  const data = await shopifyStorefrontFetch<any>(STOREFRONT_QUERIES.products, { first: limit });
  return data.products?.edges.map((e: any) => e.node) || [];
}

export async function fetchCollections() {

  const data = await shopifyStorefrontFetch<any>(STOREFRONT_QUERIES.collections, { first: 50 });
  return data.collections.edges.map((e: any) => ({
    ...e.node,
    productsCount: e.node.productsCount?.totalCount || 0
  }));
}

export async function fetchCollectionProducts(handle: string, limit: number = 20, cursor?: string) {
  const data = await shopifyStorefrontFetch<any>(STOREFRONT_QUERIES.collectionProducts, { handle, first: limit, cursor });
  return data.collection?.products || { edges: [] };
}

export async function fetchProductDetail(handle: string) {
  const data = await shopifyStorefrontFetch<any>(STOREFRONT_QUERIES.productByHandle, { handle });
  return data.product;
}

export async function fetchSearch(query: string, limit: number = 20) {
  const data = await shopifyStorefrontFetch<any>(STOREFRONT_QUERIES.search, { query, first: limit });
  return data.search?.edges.map((e: any) => e.node) || [];
}
