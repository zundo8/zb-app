"use client";

import { useEffect } from 'react';

/**
 * A custom hook to simulate real-time updates on Vercel without WebSockets.
 * It uses a smart polling mechanism to dispatch a synchronization event
 * periodically or when the window regains focus, allowing pages to update
 * their data silently in the background.
 */
export function useRealtimeSync(intervalMs = 15000) {
  useEffect(() => {
    const triggerSync = () => {
      window.dispatchEvent(new CustomEvent("realtime-sync"));
    };

    // Polling interval
    const intervalId = setInterval(triggerSync, intervalMs);

    // Refresh instantly when the user comes back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs]);
}

