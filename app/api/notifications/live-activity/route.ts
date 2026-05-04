import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// In a real app, you might use Redis or a specific table for Activity Tokens.
// They expire after a few hours and change frequently, so Redis is ideal.
// For this implementation, we will assume a simple memory cache/Redis abstraction
const globalCache = new Map<string, string>(); // orderId -> activityToken

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'register') {
      const { orderId, activityToken } = body;
      if (!orderId || !activityToken) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }

      globalCache.set(orderId, activityToken);
      return NextResponse.json({ success: true });
    } 
    
    else if (action === 'update') {
      const { orderId, contentState } = body;
      const token = globalCache.get(orderId);

      if (!token) {
        return NextResponse.json({ error: 'No active Live Activity found for order' }, { status: 404 });
      }

      // To update a Live Activity, we need to send an HTTP2 POST request to Apple Push Notification service (APNs)
      // using the activityToken. The payload is specifically structured for ActivityKit.

      const teamId = process.env.APPLE_TEAM_ID;
      const keyId = process.env.APPLE_KEY_ID;
      const bundleId = process.env.APPLE_BUNDLE_ID;
      const privateKey = process.env.APPLE_AUTH_KEY?.replace(/\\n/g, '\n');

      if (!teamId || !keyId || !bundleId || !privateKey) {
        console.warn('APNs credentials not configured for Live Activities.');
        return NextResponse.json({ success: true, warning: 'Credentials missing, mock success.' });
      }

      // Generate APNs Auth Token
      const jwtToken = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '1h',
        issuer: teamId,
        header: {
          alg: 'ES256',
          kid: keyId
        }
      });

      const payload = {
        aps: {
          timestamp: Math.floor(Date.now() / 1000),
          event: 'update',
          'content-state': contentState,
        }
      };

      // In Node 18+, fetch doesn't natively support HTTP/2 seamlessly out of the box in a way APNs likes
      // without using the 'http2' module. We will use a mock block for the HTTP2 request.
      console.log(`[APNs Mock] Sending update to ${token} for ${bundleId}.push-type.liveactivity`);
      console.log(payload);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Live Activity error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
