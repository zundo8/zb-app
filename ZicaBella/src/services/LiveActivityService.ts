import { NativeModules, Platform } from 'react-native';
import { config } from '../constants/config';
import { useAuthStore } from '../store/authStore';

// Assuming a native module named 'LiveActivityModule' is provided by a custom Expo plugin or native code
const LiveActivityModule = NativeModules.LiveActivityModule;

export interface OrderActivityData {
  orderId: string;
  status: string; // 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'
  estimatedDelivery: string;
  itemsCount: number;
}

export const LiveActivityService = {
  /**
   * Starts a new Live Activity for an order
   */
  async startOrderActivity(data: OrderActivityData): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    
    try {
      if (!LiveActivityModule) {
        console.warn('LiveActivityModule is not linked.');
        return null;
      }

      // Start the activity natively and get a push token
      const pushToken = await LiveActivityModule.startActivity('OrderTracking', {
        orderId: data.orderId,
        status: data.status,
        estimatedDelivery: data.estimatedDelivery,
        itemsCount: data.itemsCount.toString(),
      });

      if (pushToken) {
        // Send the token to the backend so it can send ActivityKit pushes
        await this.registerActivityToken(data.orderId, pushToken);
      }

      return pushToken;
    } catch (error) {
      console.error('Failed to start Live Activity:', error);
      return null;
    }
  },

  /**
   * Updates an existing Live Activity locally
   */
  async updateOrderActivity(data: OrderActivityData) {
    if (Platform.OS !== 'ios' || !LiveActivityModule) return;
    
    try {
      await LiveActivityModule.updateActivity('OrderTracking', {
        orderId: data.orderId,
        status: data.status,
        estimatedDelivery: data.estimatedDelivery,
        itemsCount: data.itemsCount.toString(),
      });
    } catch (error) {
      console.error('Failed to update Live Activity locally:', error);
    }
  },

  /**
   * Ends a Live Activity locally
   */
  async endOrderActivity(orderId: string) {
    if (Platform.OS !== 'ios' || !LiveActivityModule) return;
    
    try {
      await LiveActivityModule.endActivity('OrderTracking', { orderId });
    } catch (error) {
      console.error('Failed to end Live Activity:', error);
    }
  },

  /**
   * Registers the Activity push token with the backend
   */
  async registerActivityToken(orderId: string, token: string) {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;

    try {
      await fetch(`${config.appUrl}/api/notifications/live-activity/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          orderId,
          activityToken: token,
        }),
      });
    } catch (error) {
      console.error('Failed to register Live Activity token:', error);
    }
  }
};
