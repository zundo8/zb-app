import { triggerPusherEvent } from '@/lib/pusher';

/**
 * Triggers a real-time event to an individual affiliate's channel
 */
export async function triggerAffiliateEvent(
  affiliateId: string,
  event: 'click' | 'conversion' | 'confirmed' | 'reversal' | 'withdrawal_update',
  data: any
) {
  const channel = `affiliate-${affiliateId}`;
  return triggerPusherEvent(channel, event, data);
}
