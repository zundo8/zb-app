import { create } from 'zustand';
import { config } from '../constants/config';

interface AdminState {
  settings: any | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetchSettings: (force?: boolean) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  lastFetched: null,

  fetchSettings: async (force = false) => {
    const { lastFetched, loading } = get();
    const now = Date.now();
    
    // Cache for 5 minutes unless forced
    if (!force && lastFetched && (now - lastFetched < 300000) && get().settings) {
      return;
    }

    if (loading) return;

    set({ loading: true, error: null });

    try {
      const res = await fetch(`${config.appUrl}/api/app/config?t=${now}`);
      const data = await res.json();
      
      if (data.config) {
        set({ settings: data.config, lastFetched: now, loading: false });
      } else if (!data.error) {
        set({ settings: data, lastFetched: now, loading: false });
      } else {
        throw new Error(data.error || 'Failed to load settings');
      }
    } catch (err: any) {
      console.error('Error fetching admin settings:', err);
      set({ error: err.message, loading: false });
    }
  },
}));
