import jwt from 'jsonwebtoken';

export type AppAuthTokenPayload = {
  customerId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

function getAppJwtSecret() {
  const secret = process.env.APP_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('Missing APP_JWT_SECRET (or NEXTAUTH_SECRET fallback).');
  }
  return secret;
}

export function signAppToken(payload: AppAuthTokenPayload) {
  return jwt.sign(payload, getAppJwtSecret(), { expiresIn: '30d' });
}

export function verifyAppToken(token: string): AppAuthTokenPayload {
  const decoded = jwt.verify(token, getAppJwtSecret());
  if (typeof decoded !== 'object' || !decoded) throw new Error('Invalid token');
  const customerId = (decoded as any).customerId;
  if (!customerId || typeof customerId !== 'string') throw new Error('Invalid token');
  return {
    customerId,
    customerEmail: typeof (decoded as any).customerEmail === 'string' ? (decoded as any).customerEmail : null,
    customerPhone: typeof (decoded as any).customerPhone === 'string' ? (decoded as any).customerPhone : null,
  };
}

export function getAppAuthFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    return verifyAppToken(token);
  } catch {
    return null;
  }
}

