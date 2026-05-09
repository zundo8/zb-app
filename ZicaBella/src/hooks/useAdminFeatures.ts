import { useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import { useCommunityStore } from '../store/communityStore';

/**
 * Hook for global admin settings (hero, spotlight, etc)
 */
export function useAdminSettings() {
  const { settings, loading, fetchSettings } = useAdminStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, refetch: () => fetchSettings(true) };
}

/**
 * Hook for featured community looks/users
 * Connects to centralized communityStore for real-time sync across pages
 */
export function useFeaturedUsers() {
  const { looks, loading, fetchCommunityData } = useCommunityStore();

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  return { users: looks, loading, refetch: () => fetchCommunityData(true) };
}
