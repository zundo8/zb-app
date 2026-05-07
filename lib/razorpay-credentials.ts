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
    // DB unavailable — fall through to env-only
  }

  if (validKeyId(dbId) && validSecret(dbSecret)) {
    return { key_id: dbId, key_secret: dbSecret, source: 'database' };
  }

  if (validKeyId(envId) && validSecret(envSecret)) {
    return { key_id: envId, key_secret: envSecret, source: 'environment' };
  }

  throw new Error(
    'Razorpay keys not configured. Add Razorpay Key ID and Secret in Dashboard → Settings → Payment Gateways (or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server).'
  );
}

export async function isRazorpayConfigured(): Promise<boolean> {
  try {
    await resolveRazorpayCredentials();
    return true;
  } catch {
    return false;
  }
}
