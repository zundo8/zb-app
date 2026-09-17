import crypto from 'crypto';
import prisma from '@/lib/db';

const SAFE_ALPHANUMERIC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a random alphanumeric string from safe character set
 */
function randomString(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += SAFE_ALPHANUMERIC[bytes[i] % SAFE_ALPHANUMERIC.length];
  }
  return result;
}

/**
 * Generates a unique collision-checked affiliate code (e.g. "ZBSNEHA7X" or "ZB9X4R2")
 */
export async function generateUniqueAffiliateCode(nameHint?: string | null): Promise<string> {
  let cleanHint = '';
  if (nameHint) {
    cleanHint = nameHint
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 5);
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = randomString(4);
    const candidate = cleanHint ? `ZB${cleanHint}${suffix}`.slice(0, 10) : `ZB${randomString(6)}`;

    // Exact indexed equality lookup
    const existing = await prisma.affiliate.findUnique({
      where: { code: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  // Fallback with timestamp randomness
  return `ZB${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Generates a unique slug for an affiliate link
 */
export async function generateUniqueLinkSlug(baseCode: string, targetType?: string): Promise<string> {
  const cleanBase = baseCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefix = targetType && targetType !== 'STORE' ? `${targetType.toLowerCase().slice(0, 3)}-` : '';

  for (let attempt = 0; attempt < 10; attempt++) {
    const randomPart = attempt === 0 && (!targetType || targetType === 'STORE')
      ? ''
      : `-${randomString(4).toLowerCase()}`;
    const candidate = `${prefix}${cleanBase}${randomPart}`;

    const existing = await prisma.affiliateLink.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${cleanBase}-${Date.now().toString(36).toLowerCase()}`;
}
