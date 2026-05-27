import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

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
  dismissedIds: string[];
  pushToken: string | null;
  addNotification: (notification: NotificationItem) => void;
  setNotifications: (notifications: NotificationItem[]) => void;
  dismissNotification: (id: string) => void;
  setPushToken: (token: string) => void;
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
      dismissedIds: [],
      pushToken: null,
      addNotification: (notification) => set((state) => {
        const id = String(notification.id).trim();
        // Check if already dismissed or already exists
        if (state.dismissedIds.includes(id) || state.notifications.some(n => String(n.id) === id)) {
          return state;
        }
        const newNotification = { ...notification, id };
        const current = [newNotification, ...state.notifications];
        if (current.length > 50) current.pop();
        return { notifications: current };
      }),
      setNotifications: (incoming) => set((state) => {
        const existingMap = new Map(state.notifications.map(n => [String(n.id), n]));
        const seen = new Set<string>();
        const merged: NotificationItem[] = [];

        for (const n of incoming) {
          const id = String(n.id).trim();
          // Skip if dismissed
          if (state.dismissedIds.includes(id)) continue;
          if (seen.has(id)) continue;
          seen.add(id);
          const existing = existingMap.get(id);
          merged.push({
            ...n,
            id,
            isRead: existing ? existing.isRead : n.isRead,
          });
        }

        for (const local of state.notifications) {
          const id = String(local.id).trim();
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(local);
          }
        }

        return { notifications: merged.slice(0, 50) };
      }),
      dismissNotification: (id) => set((state) => {
        const idToDismiss = String(id).trim();
        const updated = state.notifications.filter(n => String(n.id) !== idToDismiss);
        const newDismissed = [...state.dismissedIds, idToDismiss].slice(-200); // Keep last 200
        return { 
          notifications: updated,
          dismissedIds: newDismissed
        };
      }),
      setPushToken: (token) => set({ pushToken: token }),
      markAsRead: (id) => set((state) => {
        const updated = state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
        const unread = updated.filter(n => !n.isRead).length;
        Notifications.setBadgeCountAsync(unread).catch(() => {});
        return { notifications: updated };
      }),
      markAllAsRead: () => set((state) => {
        const updated = state.notifications.map(n => ({ ...n, isRead: true }));
        Notifications.setBadgeCountAsync(0).catch(() => {});
        return { notifications: updated };
      }),
      clearAll: () => {
        const state = get();
        const currentIds = state.notifications.map(n => String(n.id));
        const newDismissed = Array.from(new Set([...state.dismissedIds, ...currentIds])).slice(-200);
        Notifications.setBadgeCountAsync(0).catch(() => {});
        set({ notifications: [], dismissedIds: newDismissed });
      },
      unreadCount: () => get().notifications.filter(n => !n.isRead).length
    }),
    {
      name: 'zicabella-notifications',
      storage: createJSONStorage(() => notificationStorage),
    }
  )
);
