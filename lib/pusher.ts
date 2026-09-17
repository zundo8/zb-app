import Pusher from 'pusher';

let pusherInstance: Pusher | null = null;

/**
 * Returns a singleton Pusher server instance, or null if unconfigured
 */
export function getPusherServer(): Pusher | null {
  if (pusherInstance) return pusherInstance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2';

  if (!appId || !key || !secret) {
    // Unconfigured: no-op cleanly without throwing
    return null;
  }

  pusherInstance = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherInstance;
}

/**
 * Safely triggers an event on a Pusher channel.
 * Gracefully no-ops when Pusher credentials are not provided.
 */
export async function triggerPusherEvent(channel: string, event: string, data: any): Promise<boolean> {
  const pusher = getPusherServer();
  if (!pusher) {
    // Silently no-op when unconfigured
    return false;
  }

  try {
    await pusher.trigger(channel, event, data);
    return true;
  } catch (error: any) {
    console.warn(`[Pusher] Event delivery failed for channel=${channel}, event=${event}:`, error.message);
    return false;
  }
}

let pusherClientInstance: any = null;

/**
 * Returns a singleton Pusher client instance in the browser, or null if unconfigured
 */
export function getPusherClient(): any {
  if (typeof window === 'undefined') return null;
  if (pusherClientInstance) return pusherClientInstance;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2';

  if (!key) return null;

  try {
    const PusherClient = require('pusher-js');
    pusherClientInstance = new PusherClient(key, { cluster });
    return pusherClientInstance;
  } catch {
    return null;
  }
}
