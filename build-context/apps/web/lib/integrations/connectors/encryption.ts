/**
 * Credential Encryption Utility
 * 
 * Provides AES-256-GCM encryption for sensitive credentials stored in the database.
 * Uses a master key from environment variables with per-credential random IVs.
 * 
 * IMPORTANT: In production, consider using:
 * - Azure Key Vault
 * - AWS KMS
 * - HashiCorp Vault
 * 
 * for key management instead of environment variables.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
// AUTH_TAG_LENGTH = 16 (128 bits) - standard for AES-GCM
// SALT_LENGTH = 32 - for key derivation
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment
function getMasterKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  
  if (!key) {
    // In development, use a default key (NOT for production!)
    if (process.env.NODE_ENV === 'development') {
      console.warn('WARNING: Using default encryption key. Set CREDENTIAL_ENCRYPTION_KEY in production.');
      return Buffer.from('dev-only-encryption-key-32bytes!');
    }
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is required');
  }

  // If key is hex-encoded (64 chars for 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // If key is a passphrase, derive a key using scrypt
  const salt = Buffer.from('contigo-credential-salt', 'utf8');
  return scryptSync(key, salt, KEY_LENGTH);
}

export interface EncryptedData {
  encrypted: string; // Base64 encoded ciphertext
  iv: string; // Base64 encoded IV
  authTag: string; // Base64 encoded authentication tag
  version: number; // Encryption version for future upgrades
}

/**
 * Encrypt sensitive data
 * @param data - Plain text or object to encrypt
 * @returns Encrypted data object
 */
export function encryptCredentials(data: unknown): EncryptedData {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  
  // Convert data to JSON string if it's an object
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    version: 1,
  };
}

/**
 * Decrypt sensitive data
 * @param encryptedData - Encrypted data object
 * @returns Decrypted data (parsed as JSON if possible)
 */
export function decryptCredentials<T = unknown>(encryptedData: EncryptedData): T {
  const key = getMasterKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  // Try to parse as JSON
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as T;
  }
}

/**
 * Check if data is encrypted
 */
export function isEncrypted(data: unknown): data is EncryptedData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.encrypted === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.authTag === 'string' &&
    typeof obj.version === 'number'
  );
}

/**
 * Encrypt credentials if not already encrypted
 */
export function ensureEncrypted(data: unknown): EncryptedData {
  if (isEncrypted(data)) {
    return data;
  }
  return encryptCredentials(data);
}

/**
 * Decrypt credentials if encrypted, otherwise return as-is
 */
export function ensureDecrypted<T = unknown>(data: unknown): T {
  if (isEncrypted(data)) {
    return decryptCredentials<T>(data);
  }
  return data as T;
}

/**
 * Generate a new encryption key (for setup)
 * @returns Hex-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Rotate encryption key for a credential
 * Re-encrypts data with the current key
 */
export function rotateCredentialEncryption(
  encryptedData: EncryptedData,
  oldKey: string
): EncryptedData {
  // Decrypt with old key
  const oldKeyBuffer = Buffer.from(oldKey, 'hex');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, oldKeyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  // Re-encrypt with current key
  return encryptCredentials(decrypted);
}

/**
 * Mask sensitive fields for logging/display
 */
export function maskSensitiveFields<T extends Record<string, unknown>>(
  data: T,
  fieldsToMask: string[] = ['password', 'secret', 'key', 'token', 'accessToken', 'refreshToken', 'privateKey']
): T {
  const masked: Record<string, unknown> = { ...data };
  
  for (const field of fieldsToMask) {
    if (field in masked && typeof masked[field] === 'string') {
      const value = masked[field] as string;
      if (value.length > 8) {
        masked[field] = `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
      } else {
        masked[field] = '********';
      }
    }
  }
  
  // Recursively mask nested objects
  for (const key of Object.keys(masked)) {
    if (typeof masked[key] === 'object' && masked[key] !== null && !Array.isArray(masked[key])) {
      masked[key] = maskSensitiveFields(
        masked[key] as Record<string, unknown>,
        fieldsToMask
      );
    }
  }
  
  return masked as T;
}
