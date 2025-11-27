/**
 * Security Utilities
 * Encryption, Hashing, and Key Management
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// =====================
// Configuration
// =====================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get encryption key from environment
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('[Security] ENCRYPTION_KEY not set, using fallback key. DO NOT USE IN PRODUCTION!');
    return 'default-dev-key-do-not-use-in-production-123456';
  }
  return key;
}

// =====================
// Encryption Functions
// =====================

/**
 * Encrypt sensitive data (e.g., API keys, tokens)
 * Returns base64 encoded string: salt:iv:authTag:encryptedData
 */
export async function encrypt(plaintext: string): Promise<string> {
  const masterKey = getEncryptionKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  
  // Derive key from master key + salt
  const key = (await scryptAsync(masterKey, salt, KEY_LENGTH)) as Buffer;
  
  // Encrypt
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Combine all parts
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt encrypted data
 * Expects base64 encoded string from encrypt()
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const masterKey = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract parts
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  // Derive key
  const key = (await scryptAsync(masterKey, salt, KEY_LENGTH)) as Buffer;
  
  // Decrypt
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Encrypt an object (JSON serializable)
 */
export async function encryptObject<T>(obj: T): Promise<string> {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt to object
 */
export async function decryptObject<T>(encryptedData: string): Promise<T> {
  const decrypted = await decrypt(encryptedData);
  return JSON.parse(decrypted);
}

// =====================
// API Key Management
// =====================

export interface EncryptedCredentials {
  encryptedApiKey?: string;
  encryptedSecret?: string;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
}

/**
 * Encrypt integration credentials
 */
export async function encryptCredentials(credentials: {
  apiKey?: string;
  secret?: string;
  accessToken?: string;
  refreshToken?: string;
}): Promise<EncryptedCredentials> {
  const encrypted: EncryptedCredentials = {};
  
  if (credentials.apiKey) {
    encrypted.encryptedApiKey = await encrypt(credentials.apiKey);
  }
  if (credentials.secret) {
    encrypted.encryptedSecret = await encrypt(credentials.secret);
  }
  if (credentials.accessToken) {
    encrypted.encryptedAccessToken = await encrypt(credentials.accessToken);
  }
  if (credentials.refreshToken) {
    encrypted.encryptedRefreshToken = await encrypt(credentials.refreshToken);
  }
  
  return encrypted;
}

/**
 * Decrypt integration credentials
 */
export async function decryptCredentials(encrypted: EncryptedCredentials): Promise<{
  apiKey?: string;
  secret?: string;
  accessToken?: string;
  refreshToken?: string;
}> {
  const decrypted: {
    apiKey?: string;
    secret?: string;
    accessToken?: string;
    refreshToken?: string;
  } = {};
  
  if (encrypted.encryptedApiKey) {
    decrypted.apiKey = await decrypt(encrypted.encryptedApiKey);
  }
  if (encrypted.encryptedSecret) {
    decrypted.secret = await decrypt(encrypted.encryptedSecret);
  }
  if (encrypted.encryptedAccessToken) {
    decrypted.accessToken = await decrypt(encrypted.encryptedAccessToken);
  }
  if (encrypted.encryptedRefreshToken) {
    decrypted.refreshToken = await decrypt(encrypted.encryptedRefreshToken);
  }
  
  return decrypted;
}

// =====================
// Webhook Signature Verification
// =====================

import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  const expectedSignature = createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');
  
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * DocuSign Connect signature verification
 */
export function verifyDocuSignSignature(
  payload: string,
  signature: string,
  hmacKey: string
): boolean {
  // DocuSign uses HMAC-SHA256 with base64 encoding
  const expectedSignature = createHmac('sha256', hmacKey)
    .update(payload)
    .digest('base64');
  
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// =====================
// Token Generation
// =====================

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate an API key with prefix
 */
export function generateApiKey(prefix: string = 'clm'): string {
  const token = randomBytes(24).toString('base64url');
  return `${prefix}_${token}`;
}
