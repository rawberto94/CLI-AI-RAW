/**
 * Multi-Factor Authentication (MFA) Service
 * 
 * Implements TOTP-based 2FA following RFC 6238
 * 
 * Features:
 * - TOTP secret generation
 * - QR code generation for authenticator apps
 * - Token verification
 * - Backup codes generation
 * - Recovery flow
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { encryptData, decryptData } from './encryption';

// TOTP Configuration
const TOTP_CONFIG = {
  issuer: process.env.APP_NAME || 'ConTigo',
  algorithm: 'SHA1',
  digits: 6,
  period: 30, // seconds
  window: 1, // allow 1 period before/after for clock drift
};

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

/**
 * Generate a random base32 secret for TOTP
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTOTPUri(email: string, secret: string): string {
  const issuer = encodeURIComponent(TOTP_CONFIG.issuer);
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_CONFIG.algorithm}&digits=${TOTP_CONFIG.digits}&period=${TOTP_CONFIG.period}`;
}

/**
 * Generate TOTP token for current time
 */
export function generateTOTP(secret: string, timestamp?: number): string {
  const time = Math.floor((timestamp || Date.now()) / 1000 / TOTP_CONFIG.period);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time));
  
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_CONFIG.digits);
  
  return code.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(secret: string, token: string): boolean {
  const now = Date.now();
  
  // Check current and adjacent periods for clock drift tolerance
  for (let i = -TOTP_CONFIG.window; i <= TOTP_CONFIG.window; i++) {
    const timestamp = now + (i * TOTP_CONFIG.period * 1000);
    const expectedToken = generateTOTP(secret, timestamp);
    
    if (crypto.timingSafeEqual(
      Buffer.from(token.padStart(TOTP_CONFIG.digits, '0')),
      Buffer.from(expectedToken)
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Hash backup code for storage
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.replace('-', '').toLowerCase()).digest('hex');
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

export interface MFASetupResult {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}

/**
 * Initialize MFA setup for a user
 */
export async function initializeMFASetup(userId: string): Promise<MFASetupResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const secret = generateTOTPSecret();
  const qrCodeUri = generateTOTPUri(user.email, secret);
  const backupCodes = generateBackupCodes();
  
  // Store encrypted secret temporarily (not enabled until verified)
  const encryptedSecret = await encryptData(secret);
  const hashedBackupCodes = backupCodes.map(hashBackupCode);
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaPendingSecret: encryptedSecret,
      mfaPendingBackupCodes: hashedBackupCodes,
    },
  });
  
  return { secret, qrCodeUri, backupCodes };
}

/**
 * Complete MFA setup by verifying the first token
 */
export async function completeMFASetup(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      mfaPendingSecret: true, 
      mfaPendingBackupCodes: true 
    },
  });
  
  if (!user?.mfaPendingSecret) {
    throw new Error('No pending MFA setup found');
  }
  
  const secret = await decryptData(user.mfaPendingSecret);
  
  if (!verifyTOTP(secret, token)) {
    return false;
  }
  
  // MFA verified - enable it
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaSecret: user.mfaPendingSecret,
      mfaBackupCodes: user.mfaPendingBackupCodes,
      mfaPendingSecret: null,
      mfaPendingBackupCodes: [],
      mfaEnabledAt: new Date(),
    },
  });
  
  return true;
}

/**
 * Verify MFA token during login
 */
export async function verifyMFAToken(userId: string, token: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      mfaEnabled: true,
      mfaSecret: true, 
      mfaBackupCodes: true 
    },
  });
  
  if (!user?.mfaEnabled || !user.mfaSecret) {
    throw new Error('MFA not enabled for this user');
  }
  
  const secret = await decryptData(user.mfaSecret);
  
  // First try TOTP
  if (verifyTOTP(secret, token)) {
    return true;
  }
  
  // Then try backup codes
  const tokenHash = hashBackupCode(token);
  const backupCodes = user.mfaBackupCodes as string[];
  const codeIndex = backupCodes.indexOf(tokenHash);
  
  if (codeIndex !== -1) {
    // Remove used backup code
    const newCodes = [...backupCodes];
    newCodes.splice(codeIndex, 1);
    
    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: newCodes },
    });
    
    return true;
  }
  
  return false;
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      mfaPendingSecret: null,
      mfaPendingBackupCodes: [],
      mfaEnabledAt: null,
    },
  });
}

/**
 * Check if user has MFA enabled
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  });
  
  return user?.mfaEnabled ?? false;
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  });
  
  if (!user?.mfaEnabled) {
    throw new Error('MFA not enabled');
  }
  
  const backupCodes = generateBackupCodes();
  const hashedCodes = backupCodes.map(hashBackupCode);
  
  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: hashedCodes },
  });
  
  return backupCodes;
}

// ============================================================================
// BASE32 ENCODING/DECODING
// ============================================================================

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  
  return result;
}

function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  
  for (const char of cleanInput) {
    const index = BASE32_CHARS.indexOf(char);
    if (index === -1) continue;
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  
  return Buffer.from(bytes);
}
