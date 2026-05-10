import prisma from '@/lib/db';

export type RazorpayCredentialSource = 'database' | 'environment';

export type RazorpayCredentials = {
  key_id: string;
  key_secret: string;
  source: RazorpayCredentialSource;
};

function validKeyId(id?: string | null): id is string {
  return !!(id && id.startsWith('rzp_') && !id.includes('xxxx'));
}

function validSecret(secret?: string | null): secret is string {
  return !!(secret && String(secret).trim().length > 0 && !String(secret).includes('xxxx'));
}

/**
 * Resolves Razorpay credentials for server-side order creation and signature verification.
 * Prefers keys saved in the admin dashboard (Shop table) over raw environment variables
 * so Infrastructure settings and mobile checkout stay in sync.
 */
export async function resolveRazorpayCredentials(): Promise<RazorpayCredentials> {
  const envId = process.env.RAZORPAY_KEY_ID;
  const envSecret = process.env.RAZORPAY_KEY_SECRET;

  let dbId: string | null = null;
  let dbSecret: string | null = null;

  try {
    const shop = await prisma.shop.findFirst({
      select: { razorpayKeyId: true, razorpayKeySecret: true },
    });
    dbId = shop?.razorpayKeyId ?? null;
    dbSecret = shop?.razorpayKeySecret ?? null;
  } catch {
    // DB unavailable
  }

  const isLive = (id: string) => id.includes('_live_');

  // Logic: 
  // 1. If both DB and ENV have live keys, prioritize DB (dashboard control).
  // 2. If one has live and the other has test, pick live.
  // 3. Fallback to ENV if DB is missing secret.

  const dbValid = validKeyId(dbId) && validSecret(dbSecret);
  const envValid = validKeyId(envId) && validSecret(envSecret);

  if (dbValid && envValid) {
    if (isLive(dbId!) || !isLive(envId!)) {
      return { key_id: dbId!, key_secret: dbSecret!, source: 'database' };
    }
    return { key_id: envId!, key_secret: envSecret!, source: 'environment' };
  }

  if (dbValid) return { key_id: dbId!, key_secret: dbSecret!, source: 'database' };
  if (envValid) return { key_id: envId!, key_secret: envSecret!, source: 'environment' };

  throw new Error('Razorpay keys not configured correctly.');
}

export async function isRazorpayConfigured(): Promise<boolean> {
  try {
    await resolveRazorpayCredentials();
    return true;
  } catch {
    return false;
  }
}
