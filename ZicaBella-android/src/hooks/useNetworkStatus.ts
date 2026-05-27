import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useUIStore } from '../store/uiStore';

export function useNetworkStatus() {
  const setOffline = useUIStore((s) => s.setOffline);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, [setOffline]);
}
