import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';
const KEY_ENV = 'PLAID_ENCRYPTION_KEY'; // 64 hex chars = 32 bytes

function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex || hex.length !== 64) {
    throw new Error(`${KEY_ENV} must be a 64-character hex string (32 bytes)`);
  }
  return Buffer.from(hex, 'hex');
}

/** Returns "iv:authTag:ciphertext" — all hex encoded */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/** Decrypts a value produced by encrypt() */
export function decrypt(encoded: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Returns true if value looks like an encrypted token (contains two colons with hex segments) */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}
