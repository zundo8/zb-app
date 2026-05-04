/**
 * Shipment Service — Mobile API client for tracking
 */

import { config } from '../constants/config';

export interface TrackingEvent {
  status: string;
  location: string;
  timestamp: string;
  description: string;
}

export interface TrackingData {
  status: string;
  scan_history: TrackingEvent[];
  estimated_delivery: string | null;
  current_location: string | null;
  tracking_url: string | null;
  awb: string;
  courier?: string;
}

export async function trackOrder(params: { awb?: string; order_id?: string }): Promise<TrackingData> {
  const queryParams = new URLSearchParams();
  if (params.awb) queryParams.set('awb', params.awb);
  if (params.order_id) queryParams.set('order_id', params.order_id);

  const res = await fetch(`${config.appUrl}/api/logistics/track?${queryParams.toString()}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Failed to fetch tracking: ${res.status}`);
  }

  return res.json();
}

export async function checkServiceability(pincode: string): Promise<{
  serviceable: boolean;
  tat_days: number;
  cod_available?: boolean;
}> {
  const res = await fetch(`${config.appUrl}/api/logistics/serviceability?pincode=${pincode}`);
  
  if (!res.ok) {
    return { serviceable: true, tat_days: 7 }; // Graceful fallback
  }

  return res.json();
}
