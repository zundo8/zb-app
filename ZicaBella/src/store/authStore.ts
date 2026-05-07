import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '../services/NotificationService';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  image?: string;
  isCommunityMember?: boolean;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  rememberMe: boolean;

  login: (user: User, token: string) => void;
  logout: () => void;
  setBiometric: (enabled: boolean) => void;
  setRememberMe: (enabled: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
}

// Use the installed async storage backend for persisted auth state.
const authStorage = {
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

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      biometricEnabled: false,
      rememberMe: false,

      login: (user, token) => {
        set({ user, token, isAuthenticated: true });
        // Register push token for the new user session
        NotificationService.registerDevice(undefined, user.id);
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      setBiometric: (enabled) => set({ biometricEnabled: enabled }),
      setRememberMe: (enabled) => set({ rememberMe: enabled }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'zicabella-auth-secure',
      storage: createJSONStorage(() => authStorage),
    }
  )
);
