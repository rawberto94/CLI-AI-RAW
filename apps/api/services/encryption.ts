/**
 * Data Protection and Encryption Service
 * Provides end-to-end encryption and data protection capabilities
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface EncryptionKey {
  id: string;
  algorithm: string;
  keyData: Buffer;
  createdAt: Date;
  expiresAt?: Date;
  purpose: 'data' | 'file' | 'communication' | 'backup';
  status: 'active' | 'rotating' | 'deprecated' | 'revoked';
}

export interface EncryptedData {
  data: string; // Base64 encoded encrypted data
  keyId: string;
  algorithm: string;
  iv: string; // Initialization vector
  authTag?: string; // For authenticated encryption
  metadata?: {
    originalSize: number;
    contentType?: string;
    checksum: string;
  };
}

export interface DataMaskingRule {
  id: string;
  field: string;
  pattern: RegExp;
  maskType: 'partial' | 'full' | 'hash' | 'tokenize';
  maskChar: string;
  preserveLength: boolean;
  exceptions?: string[];
}

export interface AccessLog {
  id: string;
  timestamp: Date;
  userId: string;
  tenantId: string;
  action: 'encrypt' | 'decrypt' | 'mask' | 'unmask' | 'access';
  resource: string;
  resourceId: string;
  success: boolean;
  error?: string;
  metadata?: any;
}

export class EncryptionService extends EventEmitter {
  private keys = new Map<string, EncryptionKey>();
  private accessLogs: AccessLog[] = [];
  private maskingRules = new Map<string, DataMaskingRule>();
  private tokenStore = new Map<string, string>();

  constructor() {
    super();
    this.initializeDefaultKeys();
    this.setupDefaultMaskingRules();
    this.startKeyRotation();
  }

  /**
   * Encrypt data using specified algorithm
   */
  async encryptData(
    data: string | Buffer,
    keyId?: string,
    algorithm = 'aes-256-gcm'
  ): Promise<EncryptedData> {
    try {
      const key = keyId ? this.keys.get(keyId) : this.getActiveKey('data');
      if (!key) {
        throw new Error('Encryption key not found');
      }

      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      const iv = crypto.randomBytes(16);
      
      let encrypted: Buffer;
      let authTag: Buffer | undefined;

      switch (algorithm) {
        case 'aes-256-gcm':
          const gcmCipher = crypto.createCipherGCM('aes-256-gcm', key.keyData);
          gcmCipher.setAAD(Buffer.from(key.id));
          encrypted = Buffer.concat([
            gcmCipher.update(dataBuffer),
            gcmCipher.final()
          ]);
          authTag = gcmCipher.getAuthTag();
          break;

        case 'aes-256-cbc':
          const cbcCipher = crypto.createCipher('aes-256-cbc', key.keyData);
          encrypted = Buffer.concat([
            cbcCipher.update(dataBuffer),
            cbcCipher.final()
          ]);
          break;

        default:
          throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }

      const checksum = crypto.createHash('sha256').update(dataBuffer).digest('hex');

      const result: EncryptedData = {
        data: encrypted.toString('base64'),
        keyId: key.id,
        algorithm,
        iv: iv.toString('base64'),
        authTag: authTag?.toString('base64'),
        metadata: {
          originalSize: dataBuffer.length,
          checksum
        }
      };

      this.logAccess('encrypt', 'data', result.keyId, true);
      this.emit('data:encrypted', result);

      return result;
    } catch (error) {
      this.logAccess('encrypt', 'data', keyId || 'unknown', false, error.message);
      throw error;
    }
  }

  /**
   * Decrypt data
   */
  async decryptData(encryptedData: EncryptedData): Promise<Buffer> {
    try {
      const key = this.keys.get(encryptedData.keyId);
      if (!key) {
        throw new Error('Decryption key not found');
      }

      const encryptedBuffer = Buffer.from(encryptedData.data, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      
      let decrypted: Buffer;

      switch (encryptedData.algorithm) {
        case 'aes-256-gcm':
          if (!encryptedData.authTag) {
            throw new Error('Auth tag required for GCM decryption');
          }
          const gcmDecipher = crypto.createDecipherGCM('aes-256-gcm', key.keyData);
          gcmDecipher.setAAD(Buffer.from(key.id));
          gcmDecipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
          decrypted = Buffer.concat([
            gcmDecipher.update(encryptedBuffer),
            gcmDecipher.final()
          ]);
          break;

        case 'aes-256-cbc':
          const cbcDecipher = crypto.createDecipher('aes-256-cbc', key.keyData);
          decrypted = Buffer.concat([
            cbcDecipher.update(encryptedBuffer),
            cbcDecipher.final()
          ]);
          break;

        default:
          throw new Error(`Unsupported decryption algorithm: ${encryptedData.algorithm}`);
      }

      // Verify checksum if available
      if (encryptedData.metadata?.checksum) {
        const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
        if (checksum !== encryptedData.metadata.checksum) {
          throw new Error('Data integrity check failed');
        }
      }

      this.logAccess('decrypt', 'data', encryptedData.keyId, true);
      this.emit('data:decrypted', encryptedData);

      return decrypted;
    } catch (error) {
      this.logAccess('decrypt', 'data', encryptedData.keyId, false, error.message);
      throw error;
    }
  }

  /**
   * Encrypt file
   */
  async encryptFile(
    filePath: string,
    outputPath: string,
    keyId?: string
  ): Promise<EncryptedData> {
    const fs = await import('fs/promises');
    
    try {
      const fileData = await fs.readFile(filePath);
      const encrypted = await this.encryptData(fileData, keyId);
      
      // Add file metadata
      encrypted.metadata = {
        ...encrypted.metadata,
        contentType: this.getContentType(filePath)
      };

      await fs.writeFile(outputPath, JSON.stringify(encrypted));
      
      this.logAccess('encrypt', 'file', filePath, true);
      return encrypted;
    } catch (error) {
      this.logAccess('encrypt', 'file', filePath, false, error.message);
      throw error;
    }
  }

  /**
   * Decrypt file
   */
  async decryptFile(
    encryptedFilePath: string,
    outputPath: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    
    try {
      const encryptedContent = await fs.readFile(encryptedFilePath, 'utf8');
      const encryptedData: EncryptedData = JSON.parse(encryptedContent);
      
      const decrypted = await this.decryptData(encryptedData);
      await fs.writeFile(outputPath, decrypted);
      
      this.logAccess('decrypt', 'file', encryptedFilePath, true);
    } catch (error) {
      this.logAccess('decrypt', 'file', encryptedFilePath, false, error.message);
      throw error;
    }
  }

  /**
   * Mask sensitive data
   */
  maskData(data: any, rules?: DataMaskingRule[]): any {
    try {
      const rulesToApply = rules || Array.from(this.maskingRules.values());
      const masked = this.applyMaskingRules(data, rulesToApply);
      
      this.logAccess('mask', 'data', 'sensitive_data', true);
      return masked;
    } catch (error) {
      this.logAccess('mask', 'data', 'sensitive_data', false, error.message);
      throw error;
    }
  }

  /**
   * Tokenize sensitive data
   */
  tokenizeData(data: string, field: string): string {
    try {
      const token = this.generateToken();
      this.tokenStore.set(token, data);
      
      this.logAccess('tokenize', field, token, true);
      return token;
    } catch (error) {
      this.logAccess('tokenize', field, 'unknown', false, error.message);
      throw error;
    }
  }

  /**
   * Detokenize data
   */
  detokenizeData(token: string): string | null {
    try {
      const data = this.tokenStore.get(token);
      if (data) {
        this.logAccess('detokenize', 'token', token, true);
      }
      return data || null;
    } catch (error) {
      this.logAccess('detokenize', 'token', token, false, error.message);
      return null;
    }
  }

  /**
   * Generate new encryption key
   */
  generateKey(
    purpose: EncryptionKey['purpose'],
    algorithm = 'aes-256-gcm',
    expiresIn?: number
  ): EncryptionKey {
    const keySize = algorithm.includes('256') ? 32 : 16;
    const keyData = crypto.randomBytes(keySize);
    
    const key: EncryptionKey = {
      id: this.generateKeyId(),
      algorithm,
      keyData,
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : undefined,
      purpose,
      status: 'active'
    };

    this.keys.set(key.id, key);
    this.emit('key:generated', key);

    return key;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<EncryptionKey> {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new Error('Key not found for rotation');
    }

    // Mark old key as rotating
    oldKey.status = 'rotating';

    // Generate new key with same properties
    const newKey = this.generateKey(oldKey.purpose, oldKey.algorithm);
    
    // Mark old key as deprecated after rotation
    setTimeout(() => {
      oldKey.status = 'deprecated';
      this.emit('key:deprecated', oldKey);
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.emit('key:rotated', oldKey, newKey);
    return newKey;
  }

  /**
   * Revoke encryption key
   */
  revokeKey(keyId: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) {
      return false;
    }

    key.status = 'revoked';
    this.emit('key:revoked', key);
    return true;
  }

  /**
   * Add data masking rule
   */
  addMaskingRule(rule: DataMaskingRule): void {
    this.maskingRules.set(rule.id, rule);
    this.emit('masking:rule_added', rule);
  }

  /**
   * Remove data masking rule
   */
  removeMaskingRule(ruleId: string): boolean {
    const rule = this.maskingRules.get(ruleId);
    if (!rule) {
      return false;
    }

    this.maskingRules.delete(ruleId);
    this.emit('masking:rule_removed', rule);
    return true;
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    totalKeys: number;
    activeKeys: number;
    keysByPurpose: Record<string, number>;
    encryptionOperations: number;
    decryptionOperations: number;
    maskingOperations: number;
    recentActivity: AccessLog[];
  } {
    const keysByPurpose: Record<string, number> = {};
    let activeKeys = 0;

    for (const key of this.keys.values()) {
      keysByPurpose[key.purpose] = (keysByPurpose[key.purpose] || 0) + 1;
      if (key.status === 'active') {
        activeKeys++;
      }
    }

    const recentLogs = this.accessLogs.slice(-50);
    const encryptionOps = recentLogs.filter(log => log.action === 'encrypt').length;
    const decryptionOps = recentLogs.filter(log => log.action === 'decrypt').length;
    const maskingOps = recentLogs.filter(log => log.action === 'mask').length;

    return {
      totalKeys: this.keys.size,
      activeKeys,
      keysByPurpose,
      encryptionOperations: encryptionOps,
      decryptionOperations: decryptionOps,
      maskingOperations: maskingOps,
      recentActivity: recentLogs
    };
  }

  // Private helper methods

  private initializeDefaultKeys(): void {
    // Generate default keys for different purposes
    this.generateKey('data', 'aes-256-gcm');
    this.generateKey('file', 'aes-256-gcm');
    this.generateKey('communication', 'aes-256-gcm');
    this.generateKey('backup', 'aes-256-gcm');
  }

  private setupDefaultMaskingRules(): void {
    // Email masking
    this.addMaskingRule({
      id: 'email_mask',
      field: 'email',
      pattern: /^([^@]+)@(.+)$/,
      maskType: 'partial',
      maskChar: '*',
      preserveLength: false
    });

    // Phone number masking
    this.addMaskingRule({
      id: 'phone_mask',
      field: 'phone',
      pattern: /(\d{3})(\d{3})(\d{4})/,
      maskType: 'partial',
      maskChar: '*',
      preserveLength: true
    });

    // Credit card masking
    this.addMaskingRule({
      id: 'credit_card_mask',
      field: 'creditCard',
      pattern: /(\d{4})(\d{4})(\d{4})(\d{4})/,
      maskType: 'partial',
      maskChar: '*',
      preserveLength: true
    });

    // SSN masking
    this.addMaskingRule({
      id: 'ssn_mask',
      field: 'ssn',
      pattern: /(\d{3})(\d{2})(\d{4})/,
      maskType: 'partial',
      maskChar: '*',
      preserveLength: true
    });
  }

  private getActiveKey(purpose: EncryptionKey['purpose']): EncryptionKey | undefined {
    return Array.from(this.keys.values())
      .find(key => key.purpose === purpose && key.status === 'active');
  }

  private applyMaskingRules(data: any, rules: DataMaskingRule[]): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = Array.isArray(data) ? [...data] : { ...data };

    for (const [key, value] of Object.entries(masked)) {
      if (typeof value === 'string') {
        const rule = rules.find(r => r.field === key);
        if (rule) {
          masked[key] = this.applyMaskingRule(value, rule);
        }
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.applyMaskingRules(value, rules);
      }
    }

    return masked;
  }

  private applyMaskingRule(value: string, rule: DataMaskingRule): string {
    if (rule.exceptions?.includes(value)) {
      return value;
    }

    switch (rule.maskType) {
      case 'full':
        return rule.preserveLength 
          ? rule.maskChar.repeat(value.length)
          : rule.maskChar.repeat(8);

      case 'partial':
        if (rule.pattern) {
          return value.replace(rule.pattern, (match, ...groups) => {
            // Mask middle groups, keep first and last
            return groups.slice(0, -2).map((group, index) => 
              index === 0 || index === groups.length - 3 
                ? group 
                : rule.maskChar.repeat(group.length)
            ).join('');
          });
        }
        // Default partial masking
        const visibleChars = Math.min(4, Math.floor(value.length / 3));
        const start = value.substring(0, visibleChars);
        const end = value.substring(value.length - visibleChars);
        const middle = rule.maskChar.repeat(value.length - (visibleChars * 2));
        return start + middle + end;

      case 'hash':
        return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);

      case 'tokenize':
        return this.tokenizeData(value, rule.field);

      default:
        return value;
    }
  }

  private generateToken(): string {
    return 'tok_' + crypto.randomBytes(16).toString('hex');
  }

  private generateKeyId(): string {
    return 'key_' + crypto.randomBytes(8).toString('hex');
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'json': 'application/json',
      'xml': 'application/xml'
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  private logAccess(
    action: AccessLog['action'],
    resource: string,
    resourceId: string,
    success: boolean,
    error?: string,
    userId = 'system',
    tenantId = 'system'
  ): void {
    const log: AccessLog = {
      id: crypto.randomBytes(8).toString('hex'),
      timestamp: new Date(),
      userId,
      tenantId,
      action,
      resource,
      resourceId,
      success,
      error
    };

    this.accessLogs.push(log);
    
    // Keep only last 1000 logs
    if (this.accessLogs.length > 1000) {
      this.accessLogs.shift();
    }

    this.emit('access:logged', log);
  }

  private startKeyRotation(): void {
    // Check for key rotation every hour
    setInterval(() => {
      this.checkKeyRotation();
    }, 60 * 60 * 1000);
  }

  private checkKeyRotation(): void {
    const now = new Date();
    
    for (const key of this.keys.values()) {
      if (key.expiresAt && key.expiresAt <= now && key.status === 'active') {
        this.rotateKey(key.id).catch(error => {
          this.emit('key:rotation_failed', key, error);
        });
      }
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();