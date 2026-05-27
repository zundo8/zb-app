// API endpoint paths — used by hooks to fetch data from the admin dashboard proxy
// All GraphQL queries have been replaced by REST proxy calls

export const ENDPOINTS = {
  products: '/products',
  productByHandle: (handle: string) => `/products/${handle}`,
  collections: '/collections',
  collectionByHandle: (handle: string) => `/collections/${handle}`,
  search: '/search',
  orders: '/orders',
  customers: '/customers',
  config: '/config',
  cart: '/cart',
  profile: '/profile',
  settings: '/settings',
  returns: '/returns',
  exchanges: '/exchanges',
  returnRequest: '/orders/return',
} as const;

// Legacy exports maintained for backward compatibility during migration
// These are no longer used by the hooks but may be referenced in other files
export const GET_PRODUCTS = 'DEPRECATED_USE_API_PROXY';
export const GET_PRODUCT_BY_HANDLE = 'DEPRECATED_USE_API_PROXY';
export const GET_COLLECTIONS = 'DEPRECATED_USE_API_PROXY';
export const GET_COLLECTION_BY_HANDLE = 'DEPRECATED_USE_API_PROXY';
export const SEARCH_PRODUCTS = 'DEPRECATED_USE_API_PROXY';
export const CREATE_CART = 'DEPRECATED_USE_API_PROXY';
export const ADD_TO_CART = 'DEPRECATED_USE_API_PROXY';
export const REMOVE_FROM_CART = 'DEPRECATED_USE_API_PROXY';
export const UPDATE_CART_LINE = 'DEPRECATED_USE_API_PROXY';
export const GET_CART = 'DEPRECATED_USE_API_PROXY';
