import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date: string;
  isRead: boolean;
  data: Record<string, string>;
}

interface NotificationStore {
  notifications: NotificationItem[];
  addNotification: (notification: NotificationItem) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

const notificationStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      addNotification: (notification) => set((state) => {
        // Keep last 50 notifications
        const current = [notification, ...state.notifications];
        if (current.length > 50) current.pop();
        return { notifications: current };
      }),
      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
      })),
      markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true }))
      })),
      clearAll: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter(n => !n.isRead).length
    }),
    {
      name: 'zicabella-notifications',
      storage: createJSONStorage(() => notificationStorage),
    }
  )
);
