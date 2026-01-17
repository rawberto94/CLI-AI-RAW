/**
 * Environment Variable Validation
 * Validates required environment variables at startup to catch misconfigurations early
 * 
 * Cost: $0 - Pure runtime validation
 */

type EnvVarType = 'string' | 'number' | 'boolean' | 'url' | 'email';

interface EnvVarConfig {
  name: string;
  type?: EnvVarType;
  required?: boolean;
  default?: string;
  description?: string;
  validator?: (value: string) => boolean;
  sensitive?: boolean; // Don't log value
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: Record<string, {
    set: boolean;
    valid: boolean;
    value?: string;
  }>;
}

// Core environment variables required for the app to function
const CORE_ENV_VARS: EnvVarConfig[] = [
  {
    name: 'DATABASE_URL',
    type: 'url',
    required: true,
    sensitive: true,
    description: 'PostgreSQL connection string',
    validator: (v) => v.startsWith('postgres://') || v.startsWith('postgresql://'),
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    sensitive: true,
    description: 'NextAuth.js secret for JWT signing',
    validator: (v) => v.length >= 32,
  },
  {
    name: 'NEXTAUTH_URL',
    type: 'url',
    required: true,
    description: 'Base URL for NextAuth.js callbacks',
  },
];

// Optional but recommended environment variables
const OPTIONAL_ENV_VARS: EnvVarConfig[] = [
  {
    name: 'REDIS_URL',
    type: 'url',
    description: 'Redis connection for caching and real-time features',
  },
  {
    name: 'OPENAI_API_KEY',
    sensitive: true,
    description: 'OpenAI API key for AI features',
    validator: (v) => v.startsWith('sk-'),
  },
  {
    name: 'MISTRAL_API_KEY',
    sensitive: true,
    description: 'Mistral API key for alternative AI provider',
  },
  {
    name: 'MINIO_ENDPOINT',
    description: 'MinIO/S3 endpoint for file storage',
  },
  {
    name: 'MINIO_ACCESS_KEY',
    sensitive: true,
    description: 'MinIO/S3 access key',
  },
  {
    name: 'MINIO_SECRET_KEY',
    sensitive: true,
    description: 'MinIO/S3 secret key',
  },
  {
    name: 'SENTRY_DSN',
    type: 'url',
    description: 'Sentry DSN for error tracking',
  },
  {
    name: 'LOG_LEVEL',
    description: 'Logging level (trace, debug, info, warn, error)',
    validator: (v) => ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(v),
    default: 'info',
  },
];

function validateType(value: string, type: EnvVarType): boolean {
  switch (type) {
    case 'number':
      return !isNaN(Number(value)) && value.trim() !== '';
    case 'boolean':
      return ['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase());
    case 'url':
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'string':
    default:
      return value.length > 0;
  }
}

function maskSensitive(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function validateEnvironment(options?: {
  throwOnError?: boolean;
  logResults?: boolean;
}): ValidationResult {
  const { throwOnError = false, logResults: _logResults = true } = options ?? {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: ValidationResult['summary'] = {};

  // Check core variables
  for (const config of CORE_ENV_VARS) {
    const value = process.env[config.name];
    
    if (!value) {
      if (config.required) {
        errors.push(`Missing required env var: ${config.name} - ${config.description}`);
        summary[config.name] = { set: false, valid: false };
      }
      continue;
    }

    let valid = true;

    // Type validation
    if (config.type && !validateType(value, config.type)) {
      errors.push(`Invalid ${config.type} format for ${config.name}`);
      valid = false;
    }

    // Custom validator
    if (config.validator && !config.validator(value)) {
      errors.push(`Validation failed for ${config.name}: ${config.description}`);
      valid = false;
    }

    summary[config.name] = {
      set: true,
      valid,
      value: config.sensitive ? maskSensitive(value) : value,
    };
  }

  // Check optional variables
  for (const config of OPTIONAL_ENV_VARS) {
    const value = process.env[config.name];
    
    if (!value) {
      if (config.default) {
        // Apply default
        summary[config.name] = { set: false, valid: true, value: `(default: ${config.default})` };
      } else {
        warnings.push(`Optional env var not set: ${config.name} - ${config.description}`);
        summary[config.name] = { set: false, valid: true };
      }
      continue;
    }

    let valid = true;

    // Type validation
    if (config.type && !validateType(value, config.type)) {
      warnings.push(`Invalid ${config.type} format for optional ${config.name}`);
      valid = false;
    }

    // Custom validator
    if (config.validator && !config.validator(value)) {
      warnings.push(`Validation warning for ${config.name}`);
      valid = false;
    }

    summary[config.name] = {
      set: true,
      valid,
      value: config.sensitive ? maskSensitive(value) : value,
    };
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  };

  // Results are returned but not logged to console

  if (throwOnError && !result.valid) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return result;
}

/**
 * Get a typed environment variable with validation
 */
export function getEnv<T extends string | number | boolean>(
  name: string,
  options?: {
    type?: 'string' | 'number' | 'boolean';
    required?: boolean;
    default?: T;
  }
): T {
  const value = process.env[name];
  const { type = 'string', required = false, default: defaultValue } = options ?? {};

  if (!value) {
    if (required) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return defaultValue as T;
  }

  switch (type) {
    case 'number':
      return Number(value) as T;
    case 'boolean':
      return (['true', '1', 'yes'].includes(value.toLowerCase())) as unknown as T;
    default:
      return value as T;
  }
}

/**
 * Check if running in production mode
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Check if running in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Check if running in test mode
 */
export const isTest = process.env.NODE_ENV === 'test';

export default validateEnvironment;
