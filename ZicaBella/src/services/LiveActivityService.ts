export interface OrderActivityData {
  orderId: string;
  status: string; // 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'
  estimatedDelivery: string;
  itemsCount: number;
}

export const LiveActivityService = {
  /**
   * Starts a new Live Activity for an order (Disabled on Android)
   */
  async startOrderActivity(data: OrderActivityData): Promise<string | null> {
    return null;
  },

  /**
   * Updates an existing Live Activity locally (Disabled on Android)
   */
  async updateOrderActivity(data: OrderActivityData) {
  },

  /**
   * Ends a Live Activity locally (Disabled on Android)
   */
  async endOrderActivity(orderId: string) {
  },

  /**
   * Registers the Activity push token with the backend (Disabled on Android)
   */
  async registerActivityToken(orderId: string, token: string) {
  }
};
