/**
 * Unified Data Provider Factory
 * 
 * Provides a simple interface for getting data from any procurement intelligence module
 */

import { DataMode, ProviderType, DataProviderResponse } from '../types/data-provider.types';
import { RateBenchmarkingRealProvider, RateBenchmarkingMockProvider } from './rate-benchmarking-providers';
import { SupplierAnalyticsRealProvider, SupplierAnalyticsMockProvider } from './supplier-analytics-providers';
import { NegotiationPrepRealProvider, NegotiationPrepMockProvider } from './negotiation-prep-providers';
import { SavingsPipelineRealProvider, SavingsPipelineMockProvider } from './savings-pipeline-providers';
import { RenewalRadarRealProvider, RenewalRadarMockProvider } from './renewal-radar-providers';

export class UnifiedDataProviderFactory {
  /**
   * Get data from any module with automatic provider selection
   */
  async getData(
    module: ProviderType,
    params: any = {},
    mode: DataMode = DataMode.REAL
  ): Promise<DataProviderResponse<any>> {
    const provider = this.getProvider(module, mode);
    return await provider.getData(params);
  }

  /**
   * Check health of all providers
   */
  async checkAllProviders(): Promise<Record<ProviderType, { real: boolean; mock: boolean }>> {
    const modules: ProviderType[] = [
      'rate-benchmarking',
      'supplier-analytics',
      'negotiation-prep',
      'savings-pipeline',
      'renewal-radar'
    ];

    const status: any = {};

    for (const module of modules) {
      const realProvider = this.getProvider(module, DataMode.REAL);
      const mockProvider = this.getProvider(module, DataMode.MOCK);

      status[module] = {
        real: await realProvider.isAvailable(),
        mock: await mockProvider.isAvailable()
      };
    }

    return status;
  }

  /**
   * Get metadata for a specific provider
   */
  async getProviderMetadata(module: ProviderType, mode: DataMode): Promise<any> {
    const provider = this.getProvider(module, mode);
    return await provider.getMetadata();
  }

  /**
   * Get the appropriate provider instance
   */
  private getProvider(module: ProviderType, mode: DataMode): any {
    const useMock = mode === DataMode.MOCK || process.env.USE_MOCK_DATA === 'true';

    switch (module) {
      case 'rate-benchmarking':
        return useMock 
          ? new RateBenchmarkingMockProvider('rate-benchmarking')
          : new RateBenchmarkingRealProvider('rate-benchmarking');

      case 'supplier-analytics':
        return useMock
          ? new SupplierAnalyticsMockProvider('supplier-analytics')
          : new SupplierAnalyticsRealProvider('supplier-analytics');

      case 'negotiation-prep':
        return useMock
          ? new NegotiationPrepMockProvider('negotiation-prep')
          : new NegotiationPrepRealProvider('negotiation-prep');

      case 'savings-pipeline':
        return useMock
          ? new SavingsPipelineMockProvider('savings-pipeline')
          : new SavingsPipelineRealProvider('savings-pipeline');

      case 'renewal-radar':
        return useMock
          ? new RenewalRadarMockProvider('renewal-radar')
          : new RenewalRadarRealProvider('renewal-radar');

      default:
        throw new Error(`Unknown module: ${module}`);
    }
  }
}

// Singleton instance
let factoryInstance: UnifiedDataProviderFactory | null = null;

/**
 * Get the singleton factory instance
 */
export function getDataProviderFactory(): UnifiedDataProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new UnifiedDataProviderFactory();
  }
  return factoryInstance;
}
