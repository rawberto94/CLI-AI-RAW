/**
 * Data Encryption Service
 * 
 * AES-256-GCM encryption for sensitive data at rest
 * Used for encrypting MFA secrets, API keys, and other sensitive data
 */

import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment or generate a derived key
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // In development, use a derived key (NOT SECURE FOR PRODUCTION)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Encryption] WARNING: Using derived encryption key. Set ENCRYPTION_KEY in production!');
      const derivedKey = crypto.scryptSync(
        process.env.NEXTAUTH_SECRET || 'development-fallback-secret',
        'contigo-salt',
        KEY_LENGTH
      );
      return derivedKey;
    }
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  
  // If key is provided, decode from base64 or use as-is
  if (key.length === 44) {
    // Likely base64 encoded
    return Buffer.from(key, 'base64');
  } else if (key.length === 64) {
    // Likely hex encoded
    return Buffer.from(key, 'hex');
  } else if (key.length === KEY_LENGTH) {
    // Raw 32-byte key
    return Buffer.from(key);
  }
  
  // Hash the key to get consistent length
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - The data to encrypt (string or object)
 * @returns Base64 encoded string containing IV + encrypted data + auth tag
 */
export async function encryptData(plaintext: string | object): Promise<string> {
  try {
    const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
    const key = getEncryptionKey();
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    
    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine: IV (16) + AuthTag (16) + Encrypted Data
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('[Encryption] Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data encrypted with encryptData
 * @param encryptedData - Base64 encoded string from encryptData
 * @returns Decrypted string
 */
export async function decryptData(encryptedData: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract parts
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash data using SHA-256 (one-way)
 * @param data - Data to hash
 * @returns Hex-encoded hash
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash password using bcrypt-like approach with scrypt
 * @param password - Password to hash
 * @param salt - Optional salt (generated if not provided)
 * @returns Hash in format: salt:hash
 */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${hash}`;
}

/**
 * Verify password against hash
 * @param password - Password to verify
 * @param storedHash - Stored hash in format: salt:hash
 * @returns true if password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
}

/**
 * Generate a secure random token
 * @param length - Token length in bytes (default 32)
 * @returns URL-safe base64 token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate encryption key (for initial setup)
 * @returns Base64 encoded 256-bit key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}
