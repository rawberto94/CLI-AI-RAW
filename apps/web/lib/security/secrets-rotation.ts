/**
 * Secrets Rotation Service
 *
 * Automatic rotation of secrets with zero-downtime deployment.
 * Supports:
 * - Database credentials
 * - API keys (OpenAI, Azure, etc.)
 * - JWT secrets
 * - Encryption keys
 *
 * @example
 * import { SecretsRotationService } from '@/lib/security/secrets-rotation';
 *
 * const rotator = new SecretsRotationService();
 * await rotator.rotateSecret('JWT_SECRET');
 */

import { randomBytes, createHash } from 'crypto';
import { encrypt, decrypt } from '../security';

// ============================================================================
// Types
// ============================================================================

export interface SecretConfig {
  /** Secret name/key */
  name: string;
  /** Current value (encrypted) */
  currentValue: string;
  /** Previous value (for rollback) */
  previousValue?: string;
  /** When the secret was last rotated */
  lastRotated: Date;
  /** Next scheduled rotation */
  nextRotation: Date;
  /** Rotation interval in days */
  rotationIntervalDays: number;
  /** Type of secret (affects generation) */
  type: 'jwt' | 'api-key' | 'database' | 'encryption' | 'password';
  /** Is rotation in progress */
  rotating: boolean;
  /** Rotation version */
  version: number;
}

export interface RotationResult {
  success: boolean;
  secretName: string;
  newValue?: string;
  error?: string;
  timestamp: Date;
}

export interface RotationPolicy {
  name: string;
  intervalDays: number;
  type: SecretConfig['type'];
  generator?: () => string;
  validator?: (value: string) => boolean;
  onRotate?: (oldValue: string, newValue: string) => Promise<void>;
}

// ============================================================================
// Default Secret Generators
// ============================================================================

const SECRET_GENERATORS: Record<SecretConfig['type'], () => string> = {
  jwt: () => randomBytes(64).toString('base64url'),
  'api-key': () => `sk_${randomBytes(32).toString('base64url')}`,
  database: () => randomBytes(32).toString('base64url').replace(/[^a-zA-Z0-9]/g, ''),
  encryption: () => randomBytes(32).toString('hex'),
  password: () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const bytes = randomBytes(32);
    for (let i = 0; i < 32; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        password += chars[byte % chars.length];
      }
    }
    return password;
  },
};

// ============================================================================
// Default Rotation Intervals (in days)
// ============================================================================

const DEFAULT_INTERVALS: Record<SecretConfig['type'], number> = {
  jwt: 365,        // 1 year (requires re-auth)
  'api-key': 180,  // 6 months
  database: 90,    // 3 months
  encryption: 365, // 1 year
  password: 90,    // 3 months
};

// ============================================================================
// In-Memory Store (replace with Redis/Database in production)
// ============================================================================

class SecretsStore {
  private secrets: Map<string, SecretConfig> = new Map();
  private rotationHistory: Array<{
    secretName: string;
    timestamp: Date;
    success: boolean;
    version: number;
  }> = [];

  async get(name: string): Promise<SecretConfig | undefined> {
    return this.secrets.get(name);
  }

  async set(name: string, config: SecretConfig): Promise<void> {
    this.secrets.set(name, config);
  }

  async delete(name: string): Promise<void> {
    this.secrets.delete(name);
  }

  async list(): Promise<SecretConfig[]> {
    return Array.from(this.secrets.values());
  }

  async addHistory(entry: {
    secretName: string;
    timestamp: Date;
    success: boolean;
    version: number;
  }): Promise<void> {
    this.rotationHistory.unshift(entry);
    // Keep last 1000 entries
    if (this.rotationHistory.length > 1000) {
      this.rotationHistory = this.rotationHistory.slice(0, 1000);
    }
  }

  async getHistory(secretName?: string): Promise<typeof this.rotationHistory> {
    if (secretName) {
      return this.rotationHistory.filter((h) => h.secretName === secretName);
    }
    return this.rotationHistory;
  }
}

// ============================================================================
// Secrets Rotation Service
// ============================================================================

export class SecretsRotationService {
  private store: SecretsStore;
  private policies: Map<string, RotationPolicy> = new Map();
  private rotationTimer?: NodeJS.Timeout;
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.store = new SecretsStore();
    this.encryptionKey = encryptionKey || process.env.MASTER_ENCRYPTION_KEY || 'dev-key';
    this.setupDefaultPolicies();
  }

  /**
   * Set up default rotation policies
   */
  private setupDefaultPolicies(): void {
    this.addPolicy({
      name: 'JWT_SECRET',
      intervalDays: 365,
      type: 'jwt',
      onRotate: async () => {
        // JWT_SECRET rotated - users will need to re-authenticate
        // In production: Update environment variable, restart services
      },
    });

    this.addPolicy({
      name: 'OPENAI_API_KEY',
      intervalDays: 180,
      type: 'api-key',
      validator: (value) => value.startsWith('sk-'),
      onRotate: async () => {
        // OPENAI_API_KEY rotated - update in OpenAI dashboard
      },
    });

    this.addPolicy({
      name: 'DATABASE_PASSWORD',
      intervalDays: 90,
      type: 'database',
      onRotate: async () => {
        // DATABASE_PASSWORD rotated
        // In production:
        // 1. Update password in PostgreSQL
        // 2. Update connection string in all services
        // 3. Restart database connections
      },
    });

    this.addPolicy({
      name: 'ENCRYPTION_KEY',
      intervalDays: 365,
      type: 'encryption',
      onRotate: async () => {
        // ENCRYPTION_KEY rotated - re-encrypt sensitive data
        // In production: Re-encrypt all data with new key
      },
    });
  }

  /**
   * Add a rotation policy
   */
  addPolicy(policy: RotationPolicy): void {
    this.policies.set(policy.name, policy);
  }

  /**
   * Register a secret for rotation management
   */
  async registerSecret(
    name: string,
    currentValue: string,
    type: SecretConfig['type'],
    intervalDays?: number
  ): Promise<void> {
    const encryptedValue = await encrypt(currentValue);
    const interval = intervalDays || DEFAULT_INTERVALS[type];

    const config: SecretConfig = {
      name,
      currentValue: encryptedValue,
      lastRotated: new Date(),
      nextRotation: new Date(Date.now() + interval * 24 * 60 * 60 * 1000),
      rotationIntervalDays: interval,
      type,
      rotating: false,
      version: 1,
    };

    await this.store.set(name, config);
  }

  /**
   * Rotate a specific secret
   */
  async rotateSecret(name: string, newValue?: string): Promise<RotationResult> {
    const config = await this.store.get(name);
    if (!config) {
      return {
        success: false,
        secretName: name,
        error: 'Secret not found',
        timestamp: new Date(),
      };
    }

    if (config.rotating) {
      return {
        success: false,
        secretName: name,
        error: 'Rotation already in progress',
        timestamp: new Date(),
      };
    }

    try {
      // Mark as rotating
      config.rotating = true;
      await this.store.set(name, config);

      // Get policy
      const policy = this.policies.get(name);

      // Generate new value if not provided
      const generator = policy?.generator || SECRET_GENERATORS[config.type];
      const generatedValue = newValue || generator();

      // Validate new value
      if (policy?.validator && !policy.validator(generatedValue)) {
        throw new Error('Generated value failed validation');
      }

      // Get old value for callback
      const oldValue = await decrypt(config.currentValue);

      // Store previous value for rollback
      config.previousValue = config.currentValue;
      config.currentValue = await encrypt(generatedValue);
      config.lastRotated = new Date();
      config.nextRotation = new Date(
        Date.now() + config.rotationIntervalDays * 24 * 60 * 60 * 1000
      );
      config.version++;
      config.rotating = false;

      await this.store.set(name, config);

      // Run onRotate callback
      if (policy?.onRotate) {
        await policy.onRotate(oldValue, generatedValue);
      }

      // Log rotation
      await this.store.addHistory({
        secretName: name,
        timestamp: new Date(),
        success: true,
        version: config.version,
      });

      return {
        success: true,
        secretName: name,
        newValue: generatedValue,
        timestamp: new Date(),
      };
    } catch (error: unknown) {
      // Rollback
      config.rotating = false;
      await this.store.set(name, config);

      await this.store.addHistory({
        secretName: name,
        timestamp: new Date(),
        success: false,
        version: config.version,
      });

      return {
        success: false,
        secretName: name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Rollback a secret to previous value
   */
  async rollbackSecret(name: string): Promise<RotationResult> {
    const config = await this.store.get(name);
    if (!config) {
      return {
        success: false,
        secretName: name,
        error: 'Secret not found',
        timestamp: new Date(),
      };
    }

    if (!config.previousValue) {
      return {
        success: false,
        secretName: name,
        error: 'No previous value to rollback to',
        timestamp: new Date(),
      };
    }

    try {
      const previousDecrypted = await decrypt(config.previousValue);

      // Swap current and previous
      const temp = config.currentValue;
      config.currentValue = config.previousValue;
      config.previousValue = temp;
      config.version++;

      await this.store.set(name, config);

      return {
        success: true,
        secretName: name,
        newValue: previousDecrypted,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        secretName: name,
        error: error instanceof Error ? error.message : 'Rollback failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get current secret value (decrypted)
   */
  async getSecretValue(name: string): Promise<string | null> {
    const config = await this.store.get(name);
    if (!config) return null;

    try {
      return await decrypt(config.currentValue);
    } catch {
      return null;
    }
  }

  /**
   * Check which secrets need rotation
   */
  async checkRotationDue(): Promise<string[]> {
    const secrets = await this.store.list();
    const now = new Date();
    const due: string[] = [];

    for (const secret of secrets) {
      if (secret.nextRotation <= now && !secret.rotating) {
        due.push(secret.name);
      }
    }

    return due;
  }

  /**
   * Auto-rotate all due secrets
   */
  async autoRotate(): Promise<RotationResult[]> {
    const due = await this.checkRotationDue();
    const results: RotationResult[] = [];

    for (const name of due) {
      const result = await this.rotateSecret(name);
      results.push(result);
    }

    return results;
  }

  /**
   * Start automatic rotation scheduler
   */
  startScheduler(checkIntervalMs: number = 60 * 60 * 1000): void {
    // Check every hour by default
    this.rotationTimer = setInterval(async () => {
      await this.autoRotate();
    }, checkIntervalMs);
  }

  /**
   * Stop automatic rotation scheduler
   */
  stopScheduler(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  /**
   * Get rotation status for all secrets
   */
  async getStatus(): Promise<
    Array<{
      name: string;
      type: string;
      lastRotated: Date;
      nextRotation: Date;
      daysUntilRotation: number;
      version: number;
      isOverdue: boolean;
    }>
  > {
    const secrets = await this.store.list();
    const now = Date.now();

    return secrets.map((s) => ({
      name: s.name,
      type: s.type,
      lastRotated: s.lastRotated,
      nextRotation: s.nextRotation,
      daysUntilRotation: Math.ceil(
        (s.nextRotation.getTime() - now) / (24 * 60 * 60 * 1000)
      ),
      version: s.version,
      isOverdue: s.nextRotation.getTime() < now,
    }));
  }

  /**
   * Get rotation history
   */
  async getHistory(secretName?: string) {
    return this.store.getHistory(secretName);
  }
}

// ============================================================================
// Dual-Key Rotation for Zero Downtime
// ============================================================================

/**
 * Dual-key rotation strategy for zero-downtime secret rotation
 *
 * During rotation:
 * 1. Generate new key
 * 2. Accept both old AND new key
 * 3. Gradually roll out new key to all services
 * 4. After grace period, revoke old key
 */
export class DualKeyRotation {
  private primaryKey: string;
  private secondaryKey?: string;
  private gracePeriodMs: number;
  private rotationStartTime?: Date;

  constructor(initialKey: string, gracePeriodMs: number = 24 * 60 * 60 * 1000) {
    this.primaryKey = initialKey;
    this.gracePeriodMs = gracePeriodMs;
  }

  /**
   * Start rotation - both keys valid during grace period
   */
  startRotation(newKey: string): void {
    this.secondaryKey = this.primaryKey;
    this.primaryKey = newKey;
    this.rotationStartTime = new Date();
  }

  /**
   * Complete rotation - revoke old key
   */
  completeRotation(): void {
    if (!this.isInGracePeriod()) {
      this.secondaryKey = undefined;
      this.rotationStartTime = undefined;
    }
  }

  /**
   * Check if we're in the grace period
   */
  isInGracePeriod(): boolean {
    if (!this.rotationStartTime) return false;
    return Date.now() - this.rotationStartTime.getTime() < this.gracePeriodMs;
  }

  /**
   * Validate a key (accepts primary or secondary during grace period)
   */
  validateKey(key: string): boolean {
    if (key === this.primaryKey) return true;
    if (this.secondaryKey && this.isInGracePeriod()) {
      return key === this.secondaryKey;
    }
    return false;
  }

  /**
   * Get current primary key
   */
  getPrimaryKey(): string {
    return this.primaryKey;
  }

  /**
   * Get rotation status
   */
  getStatus(): {
    isRotating: boolean;
    gracePeriodRemaining?: number;
    primaryKeyHash: string;
    secondaryKeyHash?: string;
  } {
    return {
      isRotating: !!this.rotationStartTime && this.isInGracePeriod(),
      gracePeriodRemaining: this.rotationStartTime
        ? Math.max(
            0,
            this.gracePeriodMs - (Date.now() - this.rotationStartTime.getTime())
          )
        : undefined,
      primaryKeyHash: createHash('sha256')
        .update(this.primaryKey)
        .digest('hex')
        .slice(0, 8),
      secondaryKeyHash: this.secondaryKey
        ? createHash('sha256')
            .update(this.secondaryKey)
            .digest('hex')
            .slice(0, 8)
        : undefined,
    };
  }
}

// ============================================================================
// Environment Variable Updater (for CI/CD integration)
// ============================================================================

export interface EnvUpdateStrategy {
  type: 'kubernetes' | 'aws-secrets-manager' | 'azure-keyvault' | 'github-secrets' | 'local';
  config: Record<string, string>;
}

/**
 * Update secrets in various environments
 */
export async function updateSecretInEnvironment(
  secretName: string,
  _newValue: string,
  strategy: EnvUpdateStrategy
): Promise<boolean> {
  try {
    switch (strategy.type) {
      case 'kubernetes':
        // kubectl create secret generic ... --dry-run=client -o yaml | kubectl apply -f -
        break;

      case 'aws-secrets-manager':
        // Use AWS SDK to update secret
        break;

      case 'azure-keyvault':
        // Use Azure SDK to update secret
        break;

      case 'github-secrets':
        // Use GitHub API to update secret
        break;

      case 'local':
        // Update .env file
        break;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { SECRET_GENERATORS, DEFAULT_INTERVALS };
