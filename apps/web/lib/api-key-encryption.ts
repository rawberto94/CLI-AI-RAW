/**
 * API Key Encryption
 * 
 * Encrypts API keys at rest using AES-256-GCM.
 * Keys are encrypted before storage and decrypted on retrieval.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment
 * Must be a 32-byte (256-bit) key
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.API_KEY_ENCRYPTION_KEY;
  
  if (!keyString) {
    throw new Error('API_KEY_ENCRYPTION_KEY environment variable is required');
  }
  
  // Support both hex and base64 encoded keys
  if (keyString.length === 64) {
    // Hex encoded (64 chars = 32 bytes)
    return Buffer.from(keyString, 'hex');
  } else if (keyString.length === 44) {
    // Base64 encoded (44 chars ≈ 32 bytes)
    return Buffer.from(keyString, 'base64');
  } else {
    // Derive key from passphrase using PBKDF2
    const salt = process.env.API_KEY_ENCRYPTION_SALT || 'contigo-api-key-salt';
    return crypto.pbkdf2Sync(keyString, salt, 100000, 32, 'sha256');
  }
}

/**
 * Encrypt an API key for storage
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV (16) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypt an API key from storage
 */
export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Check if a value looks like an encrypted API key
 */
export function isEncryptedApiKey(value: string): boolean {
  try {
    const decoded = Buffer.from(value, 'base64');
    // Should be at least IV + AuthTag + 1 byte of ciphertext
    return decoded.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Hash an API key for lookup (one-way)
 * Use this to create a searchable hash while keeping the actual key encrypted
 */
export function hashApiKeyForLookup(apiKey: string): string {
  const salt = process.env.API_KEY_HASH_SALT || 'contigo-api-key-hash';
  return crypto
    .createHmac('sha256', salt)
    .update(apiKey)
    .digest('hex');
}

/**
 * Generate a new API key
 */
export function generateApiKey(prefix: string = 'ctg'): string {
  const random = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${random}`;
}

/**
 * Mask an API key for display
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return '***';
  }
  return `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
}

// ============================================================================
// Database Integration
// ============================================================================

interface StoredApiKey {
  id: string;
  encryptedKey: string;
  keyHash: string;
  name: string;
  scopes: string[];
  tenantId: string;
  userId: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * Create and store an API key
 */
export function prepareApiKeyForStorage(
  apiKey: string,
  metadata: Omit<StoredApiKey, 'id' | 'encryptedKey' | 'keyHash' | 'createdAt'>
): Omit<StoredApiKey, 'id'> {
  return {
    encryptedKey: encryptApiKey(apiKey),
    keyHash: hashApiKeyForLookup(apiKey),
    createdAt: new Date(),
    ...metadata,
  };
}

/**
 * Validate an API key
 */
export async function validateApiKey(
  apiKey: string,
  findByHash: (hash: string) => Promise<StoredApiKey | null>
): Promise<{ valid: boolean; key?: StoredApiKey; error?: string }> {
  const hash = hashApiKeyForLookup(apiKey);
  const stored = await findByHash(hash);
  
  if (!stored) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  // Check expiration
  if (stored.expiresAt && stored.expiresAt < new Date()) {
    return { valid: false, error: 'API key expired' };
  }
  
  // Decrypt and compare (belt and suspenders)
  try {
    const decrypted = decryptApiKey(stored.encryptedKey);
    if (decrypted !== apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }
  } catch {
    return { valid: false, error: 'Key decryption failed' };
  }
  
  return { valid: true, key: stored };
}

// ============================================================================
// Key Rotation
// ============================================================================

/**
 * Re-encrypt all API keys with a new encryption key
 * Call this during key rotation
 */
export async function rotateEncryptionKey(
  oldKey: Buffer,
  newKey: Buffer,
  getAllKeys: () => Promise<{ id: string; encryptedKey: string }[]>,
  updateKey: (id: string, encryptedKey: string) => Promise<void>
): Promise<{ rotated: number; failed: string[] }> {
  const keys = await getAllKeys();
  let rotated = 0;
  const failed: string[] = [];
  
  for (const key of keys) {
    try {
      // Decrypt with old key
      const combined = Buffer.from(key.encryptedKey, 'base64');
      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      
      const decipher = crypto.createDecipheriv(ALGORITHM, oldKey, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      const plaintext = decrypted.toString('utf8');
      
      // Re-encrypt with new key
      const newIv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, newKey, newIv);
      
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const newAuthTag = cipher.getAuthTag();
      
      const newCombined = Buffer.concat([newIv, newAuthTag, encrypted]);
      const newEncrypted = newCombined.toString('base64');
      
      await updateKey(key.id, newEncrypted);
      rotated++;
    } catch (error) {
      failed.push(key.id);
    }
  }
  
  return { rotated, failed };
}
