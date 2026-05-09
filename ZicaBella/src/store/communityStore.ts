import { create } from 'zustand';
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

export const useCommunityStore = create<CommunityState>((set, get) => ({
  looks: [],
  updates: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchCommunityData: async (force = false) => {
    const { lastFetched, loading } = get();
    const now = Date.now();
    
    // Cache for 2 minutes to keep it "live" but efficient
    if (!force && lastFetched && (now - lastFetched < 120000) && get().looks.length > 0) {
      return;
    }

    if (loading) return;
    set({ loading: true, error: null });

    try {
      // Parallel fetch for speed
      const [looksRes, updatesRes] = await Promise.all([
        fetchWithTimeout(`${config.appUrl}/api/featured-users?isTopFeatured=true&t=${now}`, {}, 8000),
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
}));
