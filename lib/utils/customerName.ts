/**
 * Customer Name Validation Utilities
 * Location: lib/utils/customerName.ts
 * 
 * Canonical definition for generic/placeholder customer name blocklist
 * used across customer creation, address sync, backfills, and chat UI routes.
 */

const GENERIC_NAME_BLOCKLIST = [
  'customer',
  'valued customer',
  'unregistered customer',
  'system',
  'there',
  'guest',
  'guest user',
  'new user',
  'n/a',
  'na',
  'unknown',
  'null',
  'undefined',
];

/**
 * Returns true if the provided string is a non-empty, non-generic, valid customer name.
 */
export function isValidName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  const lower = trimmed.toLowerCase();
  return !GENERIC_NAME_BLOCKLIST.includes(lower);
}

/**
 * Returns true if the provided name is missing or matches a known generic placeholder name.
 */
export function isGenericCustomerName(name?: string | null): boolean {
  return !isValidName(name);
}
