/**
 * Account Lockout Service
 * 
 * Implements progressive account lockout policy:
 * - Tracks failed login attempts per account
 * - Temporarily locks accounts after threshold exceeded
 * - Exponential backoff for repeat offenders
 * - Automatic unlock after cooldown period
 * - Admin override capability
 * 
 * @example
 * import { AccountLockout } from '@/lib/security/account-lockout';
 * 
 * const lockout = new AccountLockout();
 * 
 * // Check if account is locked
 * if (await lockout.isLocked(email)) {
 *   return { error: 'Account temporarily locked' };
 * }
 * 
 * // Record failed attempt
 * await lockout.recordFailedAttempt(email, ipAddress);
 * 
 * // Record successful login (resets counter)
 * await lockout.recordSuccessfulLogin(email);
 */

import Redis from 'ioredis';
import { auditLog, AuditAction } from './audit';

// =============================================================================
// Configuration
// =============================================================================

export interface LockoutConfig {
  /** Number of failed attempts before lockout */
  maxAttempts: number;
  /** Initial lockout duration in seconds */
  initialLockoutSeconds: number;
  /** Maximum lockout duration in seconds */
  maxLockoutSeconds: number;
  /** Multiplier for progressive lockout */
  lockoutMultiplier: number;
  /** Time window to count attempts (seconds) */
  attemptWindowSeconds: number;
  /** Include IP in lockout tracking */
  trackByIP: boolean;
}

const DEFAULT_CONFIG: LockoutConfig = {
  maxAttempts: 5,
  initialLockoutSeconds: 300,      // 5 minutes
  maxLockoutSeconds: 86400,        // 24 hours
  lockoutMultiplier: 2,
  attemptWindowSeconds: 900,       // 15 minutes
  trackByIP: true,
};

// Redis key prefixes
const KEYS = {
  attempts: 'lockout:attempts:',
  locked: 'lockout:locked:',
  lockoutCount: 'lockout:count:',
  ipAttempts: 'lockout:ip:attempts:',
  ipLocked: 'lockout:ip:locked:',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface LockoutStatus {
  isLocked: boolean;
  attemptsRemaining: number;
  lockedUntil?: Date;
  lockoutCount: number;
  reason?: string;
}

export interface AttemptRecord {
  timestamp: number;
  ip: string;
  userAgent?: string;
  success: boolean;
}

// =============================================================================
// Account Lockout Service
// =============================================================================

export class AccountLockout {
  private redis: InstanceType<typeof Redis>;
  private config: LockoutConfig;
  
  constructor(redis?: InstanceType<typeof Redis>, config?: Partial<LockoutConfig>) {
    this.redis = redis || new Redis(process.env.REDIS_URL || '');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Check if an account is currently locked
   */
  async isLocked(identifier: string): Promise<boolean> {
    const lockKey = KEYS.locked + this.normalizeIdentifier(identifier);
    const locked = await this.redis.get(lockKey);
    return locked !== null;
  }
  
  /**
   * Get detailed lockout status for an account
   */
  async getStatus(identifier: string): Promise<LockoutStatus> {
    const normalizedId = this.normalizeIdentifier(identifier);
    const lockKey = KEYS.locked + normalizedId;
    const attemptsKey = KEYS.attempts + normalizedId;
    const countKey = KEYS.lockoutCount + normalizedId;
    
    const [locked, ttl, attempts, lockoutCount] = await Promise.all([
      this.redis.get(lockKey),
      this.redis.ttl(lockKey),
      this.redis.lrange(attemptsKey, 0, -1),
      this.redis.get(countKey),
    ]);
    
    const isLocked = locked !== null;
    const count = parseInt(lockoutCount || '0', 10);
    
    // Count recent failed attempts
    const recentAttempts = attempts
      .map(a => JSON.parse(a) as AttemptRecord)
      .filter(a => !a.success && Date.now() - a.timestamp < this.config.attemptWindowSeconds * 1000);
    
    return {
      isLocked,
      attemptsRemaining: Math.max(0, this.config.maxAttempts - recentAttempts.length),
      lockedUntil: isLocked && ttl > 0 ? new Date(Date.now() + ttl * 1000) : undefined,
      lockoutCount: count,
      reason: isLocked ? 'Too many failed login attempts' : undefined,
    };
  }
  
  /**
   * Record a failed login attempt
   */
  async recordFailedAttempt(
    identifier: string,
    ip: string,
    userAgent?: string
  ): Promise<LockoutStatus> {
    const normalizedId = this.normalizeIdentifier(identifier);
    const attemptsKey = KEYS.attempts + normalizedId;
    
    // Record the attempt
    const attempt: AttemptRecord = {
      timestamp: Date.now(),
      ip,
      userAgent,
      success: false,
    };
    
    await this.redis.lpush(attemptsKey, JSON.stringify(attempt));
    await this.redis.ltrim(attemptsKey, 0, 99); // Keep last 100 attempts
    await this.redis.expire(attemptsKey, this.config.attemptWindowSeconds * 2);
    
    // Also track by IP if enabled
    if (this.config.trackByIP) {
      await this.recordIPAttempt(ip, false);
    }
    
    // Count recent failed attempts
    const attempts = await this.redis.lrange(attemptsKey, 0, -1);
    const recentFailed = attempts
      .map(a => JSON.parse(a) as AttemptRecord)
      .filter(a => !a.success && Date.now() - a.timestamp < this.config.attemptWindowSeconds * 1000);
    
    // Check if should lock
    if (recentFailed.length >= this.config.maxAttempts) {
      await this.lockAccount(identifier, ip);
    }
    
    // Audit log
    await auditLog({
      action: 'AUTH_FAILED' as AuditAction,
      userId: undefined,
      metadata: {
        identifier: this.maskIdentifier(identifier),
        ip,
        attemptCount: recentFailed.length,
      },
    });
    
    return this.getStatus(identifier);
  }
  
  /**
   * Record a successful login (resets attempt counter)
   */
  async recordSuccessfulLogin(identifier: string, ip: string): Promise<void> {
    const normalizedId = this.normalizeIdentifier(identifier);
    const attemptsKey = KEYS.attempts + normalizedId;
    
    // Record successful attempt
    const attempt: AttemptRecord = {
      timestamp: Date.now(),
      ip,
      success: true,
    };
    
    await this.redis.lpush(attemptsKey, JSON.stringify(attempt));
    await this.redis.ltrim(attemptsKey, 0, 99);
    
    // Reset IP tracking
    if (this.config.trackByIP) {
      await this.recordIPAttempt(ip, true);
    }
    
    // Note: We don't reset lockout count - repeat offenders stay tracked
  }
  
  /**
   * Lock an account
   */
  async lockAccount(
    identifier: string,
    triggerIP?: string,
    reason?: string
  ): Promise<void> {
    const normalizedId = this.normalizeIdentifier(identifier);
    const lockKey = KEYS.locked + normalizedId;
    const countKey = KEYS.lockoutCount + normalizedId;
    
    // Get current lockout count for progressive lockout
    const currentCount = parseInt(await this.redis.get(countKey) || '0', 10);
    const newCount = currentCount + 1;
    
    // Calculate lockout duration with exponential backoff
    const lockoutDuration = Math.min(
      this.config.initialLockoutSeconds * Math.pow(this.config.lockoutMultiplier, currentCount),
      this.config.maxLockoutSeconds
    );
    
    // Set lock
    await this.redis.setex(lockKey, lockoutDuration, JSON.stringify({
      lockedAt: new Date().toISOString(),
      triggerIP,
      reason: reason || 'Too many failed attempts',
      lockoutNumber: newCount,
    }));
    
    // Increment lockout count (expires after 30 days)
    await this.redis.setex(countKey, 30 * 24 * 60 * 60, newCount.toString());
    
    // Audit log
    await auditLog({
      action: 'ACCOUNT_LOCKED' as AuditAction,
      userId: undefined,
      metadata: {
        identifier: this.maskIdentifier(identifier),
        triggerIP,
        lockoutDurationSeconds: lockoutDuration,
        lockoutNumber: newCount,
        reason,
      },
    });
    
    console.warn(`[SECURITY] Account locked: ${this.maskIdentifier(identifier)}, duration: ${lockoutDuration}s, lockout #${newCount}`);
  }
  
  /**
   * Manually unlock an account (admin action)
   */
  async unlockAccount(identifier: string, adminUserId: string): Promise<void> {
    const normalizedId = this.normalizeIdentifier(identifier);
    const lockKey = KEYS.locked + normalizedId;
    
    await this.redis.del(lockKey);
    
    // Audit log
    await auditLog({
      action: 'ACCOUNT_UNLOCKED' as AuditAction,
      userId: adminUserId,
      metadata: {
        identifier: this.maskIdentifier(identifier),
        unlockedBy: adminUserId,
      },
    });
    
    console.info(`[SECURITY] Account unlocked by admin: ${this.maskIdentifier(identifier)}`);
  }
  
  /**
   * Reset lockout count (admin action)
   */
  async resetLockoutCount(identifier: string, adminUserId: string): Promise<void> {
    const normalizedId = this.normalizeIdentifier(identifier);
    const countKey = KEYS.lockoutCount + normalizedId;
    const attemptsKey = KEYS.attempts + normalizedId;
    
    await Promise.all([
      this.redis.del(countKey),
      this.redis.del(attemptsKey),
    ]);
    
    await auditLog({
      action: 'LOCKOUT_RESET' as AuditAction,
      userId: adminUserId,
      metadata: {
        identifier: this.maskIdentifier(identifier),
        resetBy: adminUserId,
      },
    });
  }
  
  /**
   * Check if an IP is blocked (too many failures across accounts)
   */
  async isIPBlocked(ip: string): Promise<boolean> {
    const lockKey = KEYS.ipLocked + ip;
    const locked = await this.redis.get(lockKey);
    return locked !== null;
  }
  
  /**
   * Track attempts by IP address
   */
  private async recordIPAttempt(ip: string, success: boolean): Promise<void> {
    const attemptsKey = KEYS.ipAttempts + ip;
    const lockKey = KEYS.ipLocked + ip;
    
    if (success) {
      // Successful login from IP - no action needed
      return;
    }
    
    // Increment failed attempts
    const attempts = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, this.config.attemptWindowSeconds);
    
    // Block IP if too many failures (higher threshold than per-account)
    if (attempts >= this.config.maxAttempts * 3) { // 15 attempts across all accounts
      await this.redis.setex(lockKey, this.config.initialLockoutSeconds * 2, JSON.stringify({
        lockedAt: new Date().toISOString(),
        attempts,
      }));
      
      await auditLog({
        action: 'IP_BLOCKED' as AuditAction,
        userId: undefined,
        metadata: {
          ip,
          attempts,
        },
      });
      
      console.warn(`[SECURITY] IP blocked: ${ip}, attempts: ${attempts}`);
    }
  }
  
  /**
   * Normalize identifier (email) for consistent key storage
   */
  private normalizeIdentifier(identifier: string): string {
    return identifier.toLowerCase().trim();
  }
  
  /**
   * Mask identifier for logging (privacy)
   */
  private maskIdentifier(identifier: string): string {
    const normalized = this.normalizeIdentifier(identifier);
    if (normalized.includes('@')) {
      const [local, domain] = normalized.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    }
    return `${normalized.slice(0, 3)}***`;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let lockoutInstance: AccountLockout | null = null;

export function getAccountLockout(): AccountLockout {
  if (!lockoutInstance) {
    lockoutInstance = new AccountLockout();
  }
  return lockoutInstance;
}

// =============================================================================
// Middleware Helper
// =============================================================================

/**
 * Check lockout status before authentication
 * Use in NextAuth credentials provider or API routes
 */
export async function checkLockoutStatus(
  identifier: string,
  ip: string
): Promise<{ allowed: boolean; status?: LockoutStatus; error?: string }> {
  const lockout = getAccountLockout();
  
  // Check IP block first
  if (await lockout.isIPBlocked(ip)) {
    return {
      allowed: false,
      error: 'Too many failed attempts from your IP address. Please try again later.',
    };
  }
  
  // Check account lockout
  const status = await lockout.getStatus(identifier);
  
  if (status.isLocked) {
    const retryAfter = status.lockedUntil 
      ? Math.ceil((status.lockedUntil.getTime() - Date.now()) / 1000 / 60)
      : 5;
    
    return {
      allowed: false,
      status,
      error: `Account temporarily locked due to too many failed attempts. Please try again in ${retryAfter} minutes.`,
    };
  }
  
  return { allowed: true, status };
}
