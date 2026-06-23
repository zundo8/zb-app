import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../constants/config';
import { fetchWithTimeout } from '../utils/network';

interface CommunityState {
  looks: any[];
  updates: any[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetchCommunityData: (force?: boolean) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      looks: [],
      updates: [],
      loading: false,
      error: null,
      lastFetched: null,

      fetchCommunityData: async (force = false) => {
        const { lastFetched, loading } = get();
        const now = Date.now();
        
        // Cache for 5 minutes
        if (!force && lastFetched && (now - lastFetched < 300000) && get().looks.length > 0) {
          return;
        }

        if (loading) return;
        set({ loading: true, error: null });

        try {
          // Parallel fetch for speed
          const [looksRes, updatesRes] = await Promise.all([
            fetchWithTimeout(`${config.appUrl}/api/featured-users?t=${now}`, {}, 8000),
            fetchWithTimeout(`${config.appUrl}/api/community/updates?t=${now}`, {}, 8000)
          ]);

          const [looksData, updatesData] = await Promise.all([
            looksRes.json(),
            updatesRes.json()
          ]);

          set({ 
            looks: looksData.users || [], 
            updates: updatesData.updates || [], 
            lastFetched: now, 
            loading: false 
          });
        } catch (err: any) {
          console.warn('Community data sync failed:', err.message);
          set({ error: err.message, loading: false });
        }
      },
    }),
    {
      name: 'zica-bella-community',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist loading state or errors
      partialize: (state) => ({
        looks: state.looks,
        updates: state.updates,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
