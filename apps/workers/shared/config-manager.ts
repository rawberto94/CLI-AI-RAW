/**
 * Configuration Management System
 * Handles environment-specific configuration with validation and hot-reloading
 */

import { WorkerConfig } from './base-worker';

// Configuration validation result
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Environment-specific configuration
export interface EnvironmentConfig {
  development: Partial<WorkerConfig>;
  staging: Partial<WorkerConfig>;
  production: Partial<WorkerConfig>;
}

/**
 * Configuration Manager
 * Provides centralized configuration management with validation
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: WorkerConfig;
  private watchers: Map<string, (config: WorkerConfig) => void> = new Map();

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get current configuration
   */
  getConfig(): WorkerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WorkerConfig>): ConfigValidationResult {
    const newConfig = { ...this.config, ...updates };
    const validation = this.validateConfiguration(newConfig);
    
    if (validation.isValid) {
      this.config = newConfig;
      this.notifyWatchers();
    }
    
    return validation;
  }

  /**
   * Watch for configuration changes
   */
  watchConfig(key: string, callback: (config: WorkerConfig) => void): void {
    this.watchers.set(key, callback);
  }

  /**
   * Stop watching configuration changes
   */
  unwatchConfig(key: string): void {
    this.watchers.delete(key);
  }

  /**
   * Validate configuration
   */
  validateConfiguration(config: WorkerConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // OpenAI Configuration Validation
    if (config.enableLLM) {
      if (!config.openai.apiKey) {
        errors.push('OpenAI API key is required when LLM is enabled');
      }
      if (config.openai.timeout < 1000) {
        errors.push('OpenAI timeout must be at least 1000ms');
      }
      if (config.openai.retryAttempts < 1 || config.openai.retryAttempts > 10) {
        warnings.push('OpenAI retry attempts should be between 1 and 10');
      }
    }

    // Database Configuration Validation
    if (config.database.maxConnections < 1) {
      errors.push('Database max connections must be at least 1');
    }
    if (config.database.maxConnections > 100) {
      warnings.push('Database max connections is very high, consider reducing for better performance');
    }
    if (config.database.queryTimeout < 1000) {
      warnings.push('Database query timeout is very low, may cause timeouts');
    }
    if (config.database.retryAttempts < 1 || config.database.retryAttempts > 10) {
      warnings.push('Database retry attempts should be between 1 and 10');
    }

    // Storage Configuration Validation
    if (!['local', 's3', 'azure'].includes(config.storage.provider)) {
      errors.push('Storage provider must be one of: local, s3, azure');
    }

    // Environment Configuration Validation
    if (!['development', 'staging', 'production'].includes(config.environment)) {
      errors.push('Environment must be one of: development, staging, production');
    }

    // Log Level Validation
    if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
      errors.push('Log level must be one of: debug, info, warn, error');
    }

    // Production-specific validations
    if (config.environment === 'production') {
      if (config.logLevel === 'debug') {
        warnings.push('Debug logging in production may impact performance');
      }
      if (!config.enableFallbacks) {
        warnings.push('Disabling fallbacks in production may reduce reliability');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load configuration from environment and defaults
   */
  private loadConfiguration(): WorkerConfig {
    const environment = (process.env.NODE_ENV as any) || 'development';
    const baseConfig = this.getDefaultConfiguration();
    const envConfig = this.getEnvironmentConfiguration(environment);
    
    return this.mergeConfigurations(baseConfig, envConfig);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfiguration(): WorkerConfig {
    return {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000'),
        retryAttempts: parseInt(process.env.OPENAI_RETRY_ATTEMPTS || '3')
      },
      database: {
        connectionString: process.env.DATABASE_URL,
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
        retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3')
      },
      storage: {
        provider: (process.env.STORAGE_PROVIDER as any) || 'local',
        config: this.parseStorageConfig()
      },
      enableLLM: process.env.ENABLE_LLM !== 'false', // Default to true unless explicitly disabled
      enableFallbacks: process.env.ENABLE_FALLBACKS !== 'false',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      environment: (process.env.NODE_ENV as any) || 'development',
      tenantId: process.env.TENANT_ID
    };
  }

  /**
   * Get environment-specific configuration
   */
  private getEnvironmentConfiguration(environment: string): Partial<WorkerConfig> {
    const envConfigs: EnvironmentConfig = {
      development: {
        logLevel: 'debug',
        enableFallbacks: true,
        openai: {
          model: 'gpt-4o',
          timeout: 30000,
          retryAttempts: 2
        },
        database: {
          maxConnections: 5,
          queryTimeout: 30000,
          retryAttempts: 2
        }
      },
      staging: {
        logLevel: 'info',
        enableFallbacks: true,
        openai: {
          model: 'gpt-4o',
          timeout: 45000,
          retryAttempts: 3
        },
        database: {
          maxConnections: 8,
          queryTimeout: 45000,
          retryAttempts: 3
        }
      },
      production: {
        logLevel: 'warn',
        enableFallbacks: true,
        openai: {
          model: 'gpt-4o',
          timeout: 60000,
          retryAttempts: 3
        },
        database: {
          maxConnections: 15,
          queryTimeout: 60000,
          retryAttempts: 3
        }
      }
    };

    return envConfigs[environment as keyof EnvironmentConfig] || {};
  }

  /**
   * Parse storage configuration from environment
   */
  private parseStorageConfig(): any {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    
    switch (provider) {
      case 's3':
        return {
          bucket: process.env.S3_BUCKET,
          region: process.env.S3_REGION,
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        };
      case 'azure':
        return {
          accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
          accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
          containerName: process.env.AZURE_STORAGE_CONTAINER_NAME
        };
      case 'local':
      default:
        return {
          basePath: process.env.LOCAL_STORAGE_PATH || './storage'
        };
    }
  }

  /**
   * Merge configurations with deep merge
   */
  private mergeConfigurations(base: WorkerConfig, override: Partial<WorkerConfig>): WorkerConfig {
    const merged = { ...base };

    if (override.openai) {
      merged.openai = { ...merged.openai, ...override.openai };
    }
    if (override.database) {
      merged.database = { ...merged.database, ...override.database };
    }
    if (override.storage) {
      merged.storage = { ...merged.storage, ...override.storage };
    }

    // Simple properties
    if (override.enableLLM !== undefined) merged.enableLLM = override.enableLLM;
    if (override.enableFallbacks !== undefined) merged.enableFallbacks = override.enableFallbacks;
    if (override.logLevel !== undefined) merged.logLevel = override.logLevel;
    if (override.metricsEnabled !== undefined) merged.metricsEnabled = override.metricsEnabled;
    if (override.environment !== undefined) merged.environment = override.environment;
    if (override.tenantId !== undefined) merged.tenantId = override.tenantId;

    return merged;
  }

  /**
   * Notify configuration watchers
   */
  private notifyWatchers(): void {
    for (const [key, callback] of this.watchers) {
      try {
        callback(this.config);
      } catch (error) {
        console.error(`Configuration watcher ${key} failed:`, error);
      }
    }
  }
}

/**
 * Configuration utilities
 */
export class ConfigUtils {
  /**
   * Get configuration for specific worker type
   */
  static getWorkerConfig(workerType: string): WorkerConfig {
    const manager = ConfigurationManager.getInstance();
    const baseConfig = manager.getConfig();
    
    // Worker-specific overrides can be added here
    const workerOverrides = this.getWorkerSpecificOverrides(workerType);
    
    return { ...baseConfig, ...workerOverrides };
  }

  /**
   * Validate environment variables
   */
  static validateEnvironment(): { isValid: boolean; missing: string[]; invalid: string[] } {
    const required = ['NODE_ENV'];
    const optional = [
      'OPENAI_API_KEY',
      'DATABASE_URL',
      'STORAGE_PROVIDER',
      'LOG_LEVEL',
      'ENABLE_LLM',
      'ENABLE_FALLBACKS'
    ];

    const missing: string[] = [];
    const invalid: string[] = [];

    // Check required variables
    for (const variable of required) {
      if (!process.env[variable]) {
        missing.push(variable);
      }
    }

    // Validate specific variables
    if (process.env.NODE_ENV && !['development', 'staging', 'production'].includes(process.env.NODE_ENV)) {
      invalid.push('NODE_ENV must be development, staging, or production');
    }

    if (process.env.LOG_LEVEL && !['debug', 'info', 'warn', 'error'].includes(process.env.LOG_LEVEL)) {
      invalid.push('LOG_LEVEL must be debug, info, warn, or error');
    }

    if (process.env.STORAGE_PROVIDER && !['local', 's3', 'azure'].includes(process.env.STORAGE_PROVIDER)) {
      invalid.push('STORAGE_PROVIDER must be local, s3, or azure');
    }

    return {
      isValid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid
    };
  }

  /**
   * Get worker-specific configuration overrides
   */
  private static getWorkerSpecificOverrides(workerType: string): Partial<WorkerConfig> {
    const overrides: Record<string, Partial<WorkerConfig>> = {
      ingestion: {
        openai: {
          model: 'gpt-4o',
          timeout: 90000, // Longer timeout for content analysis
          retryAttempts: 3
        }
      },
      clauses: {
        openai: {
          model: 'gpt-4o',
          timeout: 120000, // Longer timeout for complex clause analysis
          retryAttempts: 3
        }
      },
      financial: {
        openai: {
          model: 'gpt-4o',
          timeout: 60000,
          retryAttempts: 3
        }
      },
      risk: {
        openai: {
          model: 'gpt-4o',
          timeout: 90000,
          retryAttempts: 3
        }
      },
      compliance: {
        openai: {
          model: 'gpt-4o',
          timeout: 75000,
          retryAttempts: 3
        }
      },
      template: {
        openai: {
          model: 'gpt-4o',
          timeout: 90000,
          retryAttempts: 3
        }
      },
      overview: {
        openai: {
          model: 'gpt-4o',
          timeout: 60000,
          retryAttempts: 3
        }
      }
    };

    return (overrides[workerType] != null) ? overrides[workerType] : {};
  }
}

// Export singleton instance getter
export const getConfigurationManager = () => ConfigurationManager.getInstance();