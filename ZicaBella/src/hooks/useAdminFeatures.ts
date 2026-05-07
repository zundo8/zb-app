import { useState, useEffect } from 'react';
import { config } from '../constants/config';

import { useAdminStore } from '../store/adminStore';

export function useAdminSettings() {
  const { settings, loading, fetchSettings } = useAdminStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, refetch: () => fetchSettings(true) };
}

export function useFeaturedUsers(isTopFeatured = false) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = isTopFeatured 
      ? `${config.appUrl}/api/featured-users?isTopFeatured=true`
      : `${config.appUrl}/api/featured-users`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          setUsers(data.users);
        }
      })
      .catch((err) => console.error('Error fetching featured users:', err))
      .finally(() => setLoading(false));
  }, [isTopFeatured]);

  return { users, loading };
}
