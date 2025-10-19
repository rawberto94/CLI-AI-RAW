/**
 * Utility for loading mock data
 * Provides centralized access to all mock data files
 */

import { MockDataRegistry } from './types';

class MockDataLoader {
  private static instance: MockDataLoader;
  private cache: Partial<MockDataRegistry> = {};

  private constructor() {}

  static getInstance(): MockDataLoader {
    if (!MockDataLoader.instance) {
      MockDataLoader.instance = new MockDataLoader();
    }
    return MockDataLoader.instance;
  }

  /**
   * Load mock data for a specific feature
   */
  async load<K extends keyof MockDataRegistry>(
    feature: K
  ): Promise<MockDataRegistry[K]> {
    // Return from cache if available
    if (this.cache[feature]) {
      return this.cache[feature] as MockDataRegistry[K];
    }

    // Load from file
    try {
      const data = await import(`./${feature}.json`);
      this.cache[feature] = data.default || data;
      return this.cache[feature] as MockDataRegistry[K];
    } catch (error) {
      console.warn(`Failed to load mock data for ${feature}:`, error);
      // Return empty data structure
      return this.getEmptyData(feature);
    }
  }

  /**
   * Clear cache for a specific feature or all features
   */
  clearCache(feature?: keyof MockDataRegistry): void {
    if (feature) {
      delete this.cache[feature];
    } else {
      this.cache = {};
    }
  }

  /**
   * Get empty data structure for a feature
   */
  private getEmptyData<K extends keyof MockDataRegistry>(
    feature: K
  ): MockDataRegistry[K] {
    const emptyData: Record<string, any> = {
      rateCards: { roles: [], trends: [], geographic: [] },
      suppliers: { overview: [], metrics: {}, performance: {} },
      negotiations: { scenarios: [], leverage: [], talkingPoints: {} },
      savings: {
        opportunities: [],
        pipeline: {
          summary: {
            totalIdentified: 0,
            totalInProgress: 0,
            totalRealized: 0,
            conversionRate: 0
          },
          byCategory: [],
          timeline: []
        },
        roi: {
          roi: 0,
          realizedSavings: 0,
          projectedAnnualSavings: 0,
          paybackPeriod: 0
        }
      },
      renewals: { contracts: [], alerts: [], packs: {} }
    };

    return emptyData[feature] as MockDataRegistry[K];
  }
}

export const mockDataLoader = MockDataLoader.getInstance();
