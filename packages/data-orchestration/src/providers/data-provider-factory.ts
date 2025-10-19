/**
 * Data Provider Factory
 * 
 * Factory for creating appropriate data providers based on configuration.
 */

import { IDataProvider, DataMode, DataProviderConfig } from '../types/data-provider.types';
import pino from 'pino';

const logger = pino({ name: 'data-provider-factory' });

export class DataProviderFactory {
  private static realProviders: Map<string, any> = new Map();
  private static mockProviders: Map<string, any> = new Map();

  /**
   * Register a real data provider for a feature
   */
  static registerRealProvider<T>(feature: string, provider: new (feature: string) => IDataProvider<T>): void {
    this.realProviders.set(feature, provider);
    logger.info({ feature }, 'Registered real data provider');
  }

  /**
   * Register a mock data provider for a feature
   */
  static registerMockProvider<T>(feature: string, provider: new (feature: string) => IDataProvider<T>): void {
    this.mockProviders.set(feature, provider);
    logger.info({ feature }, 'Registered mock data provider');
  }

  /**
   * Create a data provider based on configuration
   */
  static async create<T>(config: DataProviderConfig): Promise<IDataProvider<T>> {
    const { mode, feature, fallbackToMock = true } = config;

    // Check for USE_MOCK_DATA environment variable
    const forceMock = process.env.USE_MOCK_DATA === 'true';

    if (forceMock || mode === 'mock') {
      return this.createMockProvider<T>(feature);
    }

    if (mode === 'real') {
      return this.createRealProvider<T>(feature);
    }

    // Auto mode: try real first, fallback to mock if unavailable
    if (mode === 'auto') {
      try {
        const realProvider = this.createRealProvider<T>(feature);
        const isAvailable = await realProvider.isAvailable();
        
        if (isAvailable) {
          logger.info({ feature }, 'Using real data provider');
          return realProvider;
        }

        if (fallbackToMock) {
          logger.warn({ feature }, 'Real data unavailable, falling back to mock');
          return this.createMockProvider<T>(feature);
        }

        throw new Error(`Real data unavailable for ${feature} and fallback disabled`);
      } catch (error) {
        if (fallbackToMock) {
          logger.warn({ feature, error }, 'Error checking real data, falling back to mock');
          return this.createMockProvider<T>(feature);
        }
        throw error;
      }
    }

    throw new Error(`Invalid data mode: ${mode}`);
  }

  private static createRealProvider<T>(feature: string): IDataProvider<T> {
    const ProviderClass = this.realProviders.get(feature);
    if (!ProviderClass) {
      throw new Error(`No real data provider registered for feature: ${feature}`);
    }
    return new ProviderClass(feature);
  }

  private static createMockProvider<T>(feature: string): IDataProvider<T> {
    const ProviderClass = this.mockProviders.get(feature);
    if (!ProviderClass) {
      throw new Error(`No mock data provider registered for feature: ${feature}`);
    }
    return new ProviderClass(feature);
  }
}
