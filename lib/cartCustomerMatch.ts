export interface CustomerIdentity {
  customerId?: string | null;
  email?: string | null;
  phone?: string | null;
  sessionToken?: string | null;
}

/**
 * Builds standard Prisma OR clauses matching customer identity across
 * customerId, sessionToken (guestId), case-insensitive email, phone, and phoneLast10.
 */
export function buildCustomerIdentityOrClauses(identity: CustomerIdentity): any[] {
  const orClauses: any[] = [];

  if (identity.customerId) {
    orClauses.push({ customerId: identity.customerId });
  }

  if (identity.sessionToken) {
    orClauses.push({ sessionToken: identity.sessionToken });
  }

  if (identity.email && identity.email.trim()) {
    orClauses.push({ email: { equals: identity.email.trim(), mode: "insensitive" as const } });
  }

  if (identity.phone && identity.phone.trim()) {
    const rawPhone = identity.phone.trim();
    orClauses.push({ phone: rawPhone });
    const cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.length >= 10) {
      const last10 = cleanPhone.slice(-10);
      orClauses.push({ phone: { contains: last10 } });
      orClauses.push({ phoneLast10: last10 });
    }
  }

  return orClauses;
}

/**
 * Checks if two sets of cart items are identical by set of (productId, variantId, size).
 */
export function areItemsIdentical(items1: any[], items2: any[]): boolean {
  if (!Array.isArray(items1) || !Array.isArray(items2)) return false;
  if (items1.length !== items2.length) return false;
  if (items1.length === 0 && items2.length === 0) return true;

  const getCanonicalKey = (item: any) => {
    const pId = String(item.productId || item.id || "").trim();
    const vId = item.variantId ? String(item.variantId).trim() : "";
    const sz = item.size ? String(item.size).trim() : "";
    return `${pId}::${vId}::${sz}`;
  };

  const keys1 = items1.map(getCanonicalKey).sort();
  const keys2 = items2.map(getCanonicalKey).sort();

  return keys1.every((key, idx) => key === keys2[idx]);
}
