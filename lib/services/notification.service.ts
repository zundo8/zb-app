import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import jwt from 'jsonwebtoken';
import db from '../db';

// ── Expo Push SDK (primary delivery path) ──────────────────────────────────
const expo = new Expo();

// ── APNs Direct Delivery (fallback for native device tokens) ───────────────
// Configuration from environment variables:
//   APNS_KEY_ID        - Apple Key ID (e.g. M9MGSZGU45)
//   APNS_TEAM_ID       - Apple Team ID (e.g. NZDV3AFAEG)
//   APNS_KEY_BASE64    - Base64-encoded .p8 private key
//   APNS_BUNDLE_ID     - iOS bundle identifier (e.g. com.zicabella.app)
//   APNS_PRODUCTION    - "true" for production, anything else for sandbox

const APNS_KEY_ID = process.env.APNS_KEY_ID || '';
const APNS_TEAM_ID = process.env.APNS_TEAM_ID || '';
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.zicabella.app';
const APNS_PRODUCTION = process.env.APNS_PRODUCTION === 'true';
const APNS_HOST = APNS_PRODUCTION
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com';

/**
 * Decode the .p8 key from base64 environment variable.
 * Returns the PEM string or null if not configured.
 */
function getApnsPrivateKey(): string | null {
  const b64 = process.env.APNS_KEY_BASE64;
  if (!b64) return null;
  try {
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    console.error('[APNs] Failed to decode APNS_KEY_BASE64');
    return null;
  }
}

// Cache the JWT for ~55 minutes (APNs tokens are valid for 60 minutes)
let _apnsJwt: string | null = null;
let _apnsJwtExpiry = 0;

/**
 * Generate (or return cached) APNs authentication JWT using the .p8 key.
 */
function getApnsJwt(): string | null {
  const now = Math.floor(Date.now() / 1000);
  if (_apnsJwt && now < _apnsJwtExpiry) return _apnsJwt;

  const privateKey = getApnsPrivateKey();
  if (!privateKey || !APNS_KEY_ID || !APNS_TEAM_ID) return null;

  _apnsJwt = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: APNS_KEY_ID,
    issuer: APNS_TEAM_ID,
    header: { alg: 'ES256', kid: APNS_KEY_ID },
    expiresIn: '55m',
  });
  _apnsJwtExpiry = now + 55 * 60;
  return _apnsJwt;
}

/**
 * Send a single notification directly to APNs using HTTP/2.
 * Returns true on success, false on failure.
 */
async function sendViaApns(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const token = getApnsJwt();
  if (!token) {
    console.error('[APNs] Cannot send — APNs key not configured.');
    return false;
  }

  const apnsPayload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      badge: 1,
      'content-available': 1,
      'mutable-content': 1,
    },
    ...(data || {}),
  };

  try {
    const response = await fetch(`${APNS_HOST}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${token}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (response.ok) return true;

    const errorBody = await response.text();
    console.error(`[APNs] Send failed (${response.status}):`, errorBody);
    return false;
  } catch (err) {
    console.error('[APNs] Network error:', err);
    return false;
  }
}

export const NotificationService = {
  /**
   * Registers or updates a device token for a user
   */
  async registerDeviceToken(data: {
    userId?: string;
    deviceId: string;
    fcmToken: string;
    platform?: string;
    appVersion?: string;
  }) {
    const finalUserId = data.userId || `GUEST_${data.deviceId}`;
    return db.deviceToken.upsert({
      where: {
        userId_deviceId: {
          userId: finalUserId,
          deviceId: data.deviceId,
        },
      },
      update: {
        fcmToken: data.fcmToken,
        platform: data.platform || 'ios',
        appVersion: data.appVersion,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: finalUserId,
        deviceId: data.deviceId,
        fcmToken: data.fcmToken,
        platform: data.platform || 'ios',
        appVersion: data.appVersion,
        isActive: true,
      },
    });
  },

  /**
   * Soft deletes a device token
   */
  async unregisterDevice(userId: string, deviceId: string) {
    return db.deviceToken.update({
      where: {
        userId_deviceId: { userId, deviceId },
      },
      data: { isActive: false },
    });
  },

  /**
   * Sends a notification to a specific user (all their active devices)
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ) {
    const devices = await db.deviceToken.findMany({
      where: { userId, isActive: true },
    });

    if (devices.length === 0) {
      return { success: false, reason: 'No active devices found.' };
    }

    const tokens = devices.map((d) => d.fcmToken);
    return this.sendToTokens(tokens, title, body, data);
  },

  /**
   * Send notifications to an array of tokens.
   *
   * Routing logic:
   *   - ExponentPushToken[...] → Expo push service (which handles APNs relay)
   *   - 64-char hex string     → Direct APNs via .p8 key
   *   - Everything else        → Expo push service (best-effort)
   */
  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ) {
    if (tokens.length === 0)
      return { success: true, successCount: 0, failureCount: 0 };

    const expoTokens: string[] = [];
    const apnsTokens: string[] = [];

    tokens.forEach((token) => {
      if (Expo.isExpoPushToken(token)) {
        expoTokens.push(token);
      } else if (/^[a-f0-9]{64}$/i.test(token)) {
        // Native APNs device token (64 hex chars)
        apnsTokens.push(token);
      } else {
        // Unknown format — try via Expo
        expoTokens.push(token);
      }
    });

    let successCount = 0;
    let failureCount = 0;

    // ── Expo Push Service ────────────────────────────────────────────────
    if (expoTokens.length > 0) {
      const messages: ExpoPushMessage[] = expoTokens.map((token) => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data: data as any,
        badge: 1,
        priority: 'high' as const,
        channelId: 'default',
        mutableContent: true,
        categoryIdentifier: 'default',
      }));

      const chunks = expo.chunkPushNotifications(messages);
      const chunkPromises = chunks.map(async (chunk) => {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          ticketChunk.forEach((ticket: any, idx: number) => {
            if (ticket.status === 'ok') {
              successCount++;
            } else {
              failureCount++;
              console.error(`[Expo] Send error: ${ticket.details?.error}`);
              if (ticket.details?.error === 'DeviceNotRegistered') {
                db.deviceToken
                  .updateMany({
                    where: { fcmToken: chunk[idx].to as string },
                    data: { isActive: false },
                  })
                  .catch(() => {});
              }
            }
          });
        } catch (error) {
          console.error('[Expo] Chunk send error:', error);
          failureCount += chunk.length;
        }
      });

      await Promise.all(chunkPromises);
    }

    // ── Direct APNs ──────────────────────────────────────────────────────
    if (apnsTokens.length > 0) {
      const apnsPromises = apnsTokens.map(async (token) => {
        const ok = await sendViaApns(token, title, body, data);
        if (ok) {
          successCount++;
        } else {
          failureCount++;
          // Deactivate tokens that fail
          db.deviceToken
            .updateMany({
              where: { fcmToken: token },
              data: { isActive: false },
            })
            .catch(() => {});
        }
      });

      await Promise.all(apnsPromises);
    }

    return { success: true, successCount, failureCount };
  },
};
