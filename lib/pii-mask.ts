/**
 * PII Masking Utilities
 * Masks sensitive phone numbers and email addresses in log output
 * to comply with P2-09 audit finding.
 */

/**
 * Masks a phone number, showing only the last 4 digits.
 * "+919876543210" → "+91******3210"
 * "9876543210" → "******3210"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '[no phone]';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  const last4 = digits.slice(-4);
  const prefix = phone.startsWith('+') ? '+' : '';
  const masked = '*'.repeat(digits.length - 4);
  return `${prefix}${masked}${last4}`;
}

/**
 * Masks an email address, showing only the first character and domain.
 * "karthik@gmail.com" → "k***@gmail.com"
 * "user@example.com" → "u***@example.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '[no email]';
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***@***';
  return `${email[0]}***${email.slice(atIndex)}`;
}

/**
 * Masks a customer identifier (phone or email) for safe logging.
 */
export function maskPII(value: string | null | undefined): string {
  if (!value) return '[redacted]';
  if (value.includes('@')) return maskEmail(value);
  return maskPhone(value);
}
