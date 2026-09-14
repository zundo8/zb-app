/**
 * Normalizes a phone number to standard E.164 format for Shopify API compatibility.
 * Rejects invalid phone numbers to avoid Shopify returning 422 Unprocessable Entity.
 */
export function toE164(raw: string | null | undefined, defaultCountry: string = 'IN'): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  if (!cleaned) return null;

  // If already starts with '+', keep the '+' and strip non-digits
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1).replace(/\D/g, '');
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }
    return null;
  }

  // Strip all non-digit characters
  const digits = cleaned.replace(/\D/g, '');

  if (defaultCountry === 'IN') {
    // Standard 10-digit Indian mobile number: 9876543210 -> +919876543210
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    // 11-digit Indian number with leading 0: 09876543210 -> +919876543210
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    // 12-digit Indian number with 91 country code prefix: 919876543210 -> +919876543210
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
  }

  // International standard fallback: 7-15 digits
  if (digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}
