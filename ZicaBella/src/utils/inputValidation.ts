/**
 * Input Sanitisation Utilities
 *
 * Validates and sanitises user-facing input before it reaches any API.
 * Prevents injection attacks and ensures data integrity.
 */

/**
 * Strip dangerous characters and HTML tags from freeform text input.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')   // Strip HTML tags
    .replace(/[<>]/g, '')      // Remove stray angle brackets
    .trim();
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate phone number (digits only, 7-15 digits).
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Sanitise and validate a phone number, returning only digits.
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').trim();
}

/**
 * Validate OTP format (6 digits).
 */
export function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp.trim());
}

/**
 * Validate name (non-empty, no script tags, 1-100 chars).
 */
export function isValidName(name: string): boolean {
  const clean = sanitizeText(name);
  return clean.length >= 1 && clean.length <= 100;
}

/**
 * Validate pincode / zip (Indian 6-digit or generic 4-10 alphanumeric).
 */
export function isValidPincode(zip: string): boolean {
  const clean = zip.trim();
  return /^[A-Za-z0-9\s-]{3,10}$/.test(clean);
}

/**
 * Sanitise an address field.
 */
export function sanitizeAddress(input: string): string {
  return sanitizeText(input).slice(0, 200);
}
