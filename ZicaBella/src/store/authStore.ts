import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../utils/secureStorage';
// NOTE: NotificationService is intentionally NOT imported at top-level to break
// the circular dependency:  authStore -> NotificationService -> authStore
// Instead it is lazily required inside the login() action.

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
        // Lazy require to avoid circular module dependency.
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { NotificationService } = require('../services/NotificationService');
          NotificationService.registerDevice(undefined, user.id);

          // Also sync bookmarks
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { useBookmarkStore } = require('./bookmarkStore');
          useBookmarkStore.getState().syncBookmarks(token);
        } catch (_e) {
          // Non-fatal
        }
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      setBiometric: (enabled) => set({ biometricEnabled: enabled }),
      setRememberMe: (enabled) => set({ rememberMe: enabled }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user 
            ? { ...state.user, ...updates } 
            : { 
                id: `guest_${Date.now()}`, 
                name: updates.name || '', 
                email: updates.email || '', 
                phone: updates.phone || '',
                isCommunityMember: false
              },
        })),
    }),
    {
      name: 'zicabella-auth-secure',
      // Use iOS Keychain via expo-secure-store instead of AsyncStorage
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
