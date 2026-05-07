/**
 * Centralized navigation types to break circular dependencies.
 * All screen components should import types from here rather than from navigators.
 */

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPasswordFlow: undefined;
  PrivacyAndTerms: { type: 'privacy' | 'terms' };
};

export type TabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  ChatTab: undefined;
  ProfileTab: undefined;
  ShopTab: undefined;
  OrdersTab: undefined;
};

export type CheckoutStackParamList = {
  DeliveryAddress: undefined;
  Payment: undefined;
  OrderReview: { paymentMethod: 'razorpay' | 'cod'; appliedCredit?: number };
};

export type ServiceStackParamList = {
  ServiceHistory: undefined;
  ReturnWizard: { orderId: string; initialItems?: string[] };
  ExchangeWizard: { orderId: string; initialItems?: string[] };
  ServiceDetail: { type: 'RETURN' | 'EXCHANGE'; id: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ProductDetail: { handle: string };
  Collection: { handle: string; title?: string };
  CheckoutFlow: undefined;
  ServiceFlow: undefined;
  OrderConfirmation: { orderId: string; orderNumber?: string; paymentMethod?: 'COD' | 'PREPAID'; estimatedDelivery?: string | null };
  OrderHistory: { openReturnFor?: string } | undefined;
  OrderDetails: { orderId: string };
  Policy: { url: string; title?: string };
  Community: undefined;
  Story: undefined;
  FAQ: undefined;
  Blogs: undefined;
  Collaborations: undefined;
  Wishlist: undefined;
};
