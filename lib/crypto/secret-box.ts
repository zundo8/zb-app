/**
 * AES-256-GCM encryption/decryption for sensitive secrets (e.g. Shopify access tokens).
 * 
 * Ciphertext format: base64(iv):base64(authTag):base64(ciphertext)
 * Key: 32-byte key from SECRET_ENCRYPTION_KEY env var (base64-encoded).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Returns the encryption key from the environment.
 * Fails loudly if missing in production.
 */
function getKey(): Buffer {
  const keyB64 = process.env.SECRET_ENCRYPTION_KEY;
  if (!keyB64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SecretBox] SECRET_ENCRYPTION_KEY is required in production. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
      );
    }
    // In dev/test, return a deterministic dev-only key (not secure, but allows local dev)
    return Buffer.from('dev-only-key-not-for-production!'); // exactly 32 bytes
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(`[SecretBox] SECRET_ENCRYPTION_KEY must be 32 bytes (got ${key.length}). Use base64-encoded 32-byte key.`);
  }
  return key;
}

/**
 * Checks if a string looks like it's already encrypted (iv:tag:ciphertext format).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => {
    try { return Buffer.from(p, 'base64').length > 0; } catch { return false; }
  });
}

/**
 * Encrypts a plaintext secret.
 * Returns: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a ciphertext blob in the format: base64(iv):base64(authTag):base64(ciphertext)
 * Returns the original plaintext.
 */
export function decryptSecret(blob: string): string {
  // If it doesn't look encrypted, return as-is (plaintext passthrough for migration)
  if (!isEncrypted(blob)) {
    return blob;
  }

  const key = getKey();
  const [ivB64, tagB64, ctB64] = blob.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
