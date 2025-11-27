/**
 * API Key Rotation Utility
 * Helper functions for secure API key management
 */

import crypto from 'crypto';

interface ApiKeyInfo {
  name: string;
  envVar: string;
  lastRotated?: Date;
  expiresAt?: Date;
  isValid: boolean;
  rotationUrl: string;
}

/**
 * Check if an API key is configured and appears valid
 */
export function validateApiKey(key: string | undefined, pattern?: RegExp): boolean {
  if (!key || key.trim() === '') return false;
  if (key.includes('your-') || key.includes('example')) return false;
  if (pattern && !pattern.test(key)) return false;
  return true;
}

/**
 * Get status of all configured API keys
 */
export function getApiKeyStatus(): ApiKeyInfo[] {
  return [
    {
      name: 'OpenAI API Key',
      envVar: 'OPENAI_API_KEY',
      isValid: validateApiKey(process.env.OPENAI_API_KEY, /^sk-/),
      rotationUrl: 'https://platform.openai.com/api-keys',
    },
    {
      name: 'Mistral API Key',
      envVar: 'MISTRAL_API_KEY',
      isValid: validateApiKey(process.env.MISTRAL_API_KEY),
      rotationUrl: 'https://console.mistral.ai/api-keys/',
    },
    {
      name: 'Auth Secret',
      envVar: 'AUTH_SECRET',
      isValid: validateApiKey(process.env.AUTH_SECRET),
      rotationUrl: 'Generate with: openssl rand -base64 32',
    },
    {
      name: 'JWT Secret',
      envVar: 'JWT_SECRET',
      isValid: validateApiKey(process.env.JWT_SECRET),
      rotationUrl: 'Generate with: openssl rand -base64 32',
    },
    {
      name: 'Session Secret',
      envVar: 'SESSION_SECRET',
      isValid: validateApiKey(process.env.SESSION_SECRET),
      rotationUrl: 'Generate with: openssl rand -base64 32',
    },
  ];
}

/**
 * Generate a new secure secret
 */
export function generateSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Mask an API key for safe logging
 */
export function maskApiKey(key: string | undefined): string {
  if (!key) return '[NOT SET]';
  if (key.length <= 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Log API key status (safe for logs)
 */
export function logApiKeyStatus(): void {
  console.log('\n=== API Key Status ===');
  const keys = getApiKeyStatus();
  
  keys.forEach(key => {
    const status = key.isValid ? '✅' : '❌';
    const value = maskApiKey(process.env[key.envVar]);
    console.log(`${status} ${key.name}: ${value}`);
    if (!key.isValid) {
      console.log(`   → Configure at: ${key.rotationUrl}`);
    }
  });
  console.log('======================\n');
}

/**
 * Check if all required API keys are configured
 */
export function areRequiredKeysConfigured(): boolean {
  const requiredKeys = ['AUTH_SECRET', 'JWT_SECRET', 'SESSION_SECRET'];
  return requiredKeys.every(key => validateApiKey(process.env[key]));
}

/**
 * Check if AI features are properly configured
 */
export function isAiConfigured(): boolean {
  return validateApiKey(process.env.OPENAI_API_KEY, /^sk-/);
}

export default {
  validateApiKey,
  getApiKeyStatus,
  generateSecret,
  maskApiKey,
  logApiKeyStatus,
  areRequiredKeysConfigured,
  isAiConfigured,
};
