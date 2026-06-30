import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID!;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN!;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

function hashValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().toLowerCase();
  // Check if it's already a 64-character SHA-256 hash (hex)
  if (/^[a-f0-9]{64}$/.test(cleaned)) {
    return cleaned;
  }
  return crypto.createHash('sha256').update(cleaned).digest('hex');
}

export interface CapiEventPayload {
  eventName: string;
  eventTime?: number;
  eventSourceUrl: string;
  eventId: string;
  userAgent: string;
  userData?: {
    country?: string;        // lowercase 2-letter ISO, hashed before sending
    st?: string;             // state/county lowercase, hashed before sending
    ge?: string;             // gender: m or f, hashed before sending
    ct?: string;             // city lowercase, hashed before sending
    zp?: string;             // zip code, hashed before sending
    fn?: string;             // first name, hashed before sending
    ln?: string;             // last name, hashed before sending
    client_user_agent?: string;
    client_ip_address?: string;
    fbp?: string;
    fbc?: string;
    em?: string;
    ph?: string;
    external_id?: string;
    fb_login_id?: string;
  };
  customData?: Record<string, any>;
  actionSource?: 'website' | 'app' | 'email' | 'phone_call' | 'physical_store' | 'system_generated' | 'other';
}

export async function sendCapiEvent(payload: CapiEventPayload): Promise<{ success: boolean; data?: any; error?: any }> {
  const body: Record<string, any> = {
    data: [
      {
        event_name: payload.eventName,
        event_time: payload.eventTime ?? Math.floor(Date.now() / 1000),
        event_source_url: payload.eventSourceUrl,
        event_id: payload.eventId,
        action_source: payload.actionSource ?? 'website',
        user_data: {
          client_user_agent: payload.userAgent,
          ...(payload.userData ? {
            client_user_agent: payload.userData.client_user_agent ?? payload.userAgent,
            client_ip_address: payload.userData.client_ip_address,
            fbp: payload.userData.fbp,
            fbc: payload.userData.fbc,
            country: hashValue(payload.userData.country),
            st: hashValue(payload.userData.st),
            ge: hashValue(payload.userData.ge),
            ct: hashValue(payload.userData.ct),
            zp: hashValue(payload.userData.zp),
            fn: hashValue(payload.userData.fn),
            ln: hashValue(payload.userData.ln),
            em: hashValue(payload.userData.em),
            ph: hashValue(payload.userData.ph),
            external_id: payload.userData.external_id,
            fb_login_id: payload.userData.fb_login_id,
          } : {}),
        },
        ...(payload.customData ? { custom_data: payload.customData } : {}),
      },
    ],
  };

  if (TEST_EVENT_CODE) {
    body.test_event_code = TEST_EVENT_CODE;
  }

  const url = `https://graph.facebook.com/v25.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const resJson = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[Meta CAPI Error]', resJson);
      return { success: false, error: resJson };
    }

    return { success: true, data: resJson };
  } catch (err: any) {
    console.error('[Meta CAPI Catch Error]', err);
    return { success: false, error: err.message || 'Fetch failed' };
  }
}
