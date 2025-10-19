/**
 * Rate Benchmarking Data Providers
 * 
 * This module provides real and mock data providers for rate benchmarking functionality.
 */

import { RealDataProvider, MockDataProvider } from './base-data-provider';
import {
  RateBenchmarkingData,
  RateBenchmarkingRequest,
  DataProviderResponse,
  DataSourceMetadata
} from '../types/data-provider.types';

/**
 * Real Data Provider for Rate Benchmarking
 * Wraps existing rate card services
 */
export class RateBenchmarkingRealProvider extends RealDataProvider<RateBenchmarkingData> {
  protected async checkServiceHealth(): Promise<boolean> {
    try {
      // Check if rate card services are available
      // This would typically ping the database or service endpoint
      return true;
    } catch (error) {
      this.log('error', 'Rate card service health check failed', error);
      return false;
    }
  }

  async getData(params?: RateBenchmarkingRequest): Promise<DataProviderResponse<RateBenchmarkingData>> {
    try {
      this.log('info', 'Fetching real rate benchmarking data', params);
      
      // Execute with retry logic
      const data = await this.executeWithRetry(
        () => this.fetchRealData(params),
        'rate-benchmarking-fetch'
      );
      
      const metadata = this.createMetadata('rate-card-database', {
        recordCount: data.marketRates.count,
        description: 'Real market rate data from database'
      });
      
      return this.createResponse(data, metadata);
    } catch (error) {
      this.log('error', 'Failed to fetch real rate benchmarking data', error);
      throw error;
    }
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    return this.createMetadata('rate-card-database', {
      description: 'Real-time rate card benchmarking data'
    });
  }

  /**
   * Fetch real data from existing services
   * This wraps the existing RateCardBenchmarkingEngine and RateCardIntelligenceService
   */
  private async fetchRealData(params?: RateBenchmarkingRequest): Promise<RateBenchmarkingData> {
    // Import existing services dynamically to avoid circular dependencies
    const { RateCardBenchmarkingEngineImpl } = await import('../services/analytical-engines/rate-card-benchmarking.engine');
    const { RateCardIntelligenceService } = await import('../services/rate-card-intelligence.service');
    
    const benchmarkingEngine = new RateCardBenchmarkingEngineImpl();
    const intelligenceService = new RateCardIntelligenceService();
    
    // Build query from params
    const query: any = {};
    if (params?.lineOfService) query.lineOfService = params.lineOfService;
    if (params?.seniority) query.seniority = params.seniority;
    if (params?.geography) query.geography = params.geography;
    if (params?.currency) query.currency = params.currency;
    
    // Fetch data from existing services
    const [marketRates, trends, geographic, comparisons] = await Promise.all([
      benchmarkingEngine.getMarketRates(query),
      benchmarkingEngine.getRateTrends(query),
      intelligenceService.getGeographicDistribution(query),
      intelligenceService.getSupplierComparisons(query)
    ]);
    
    return {
      marketRates: {
        p25: marketRates.percentiles.p25,
        p50: marketRates.percentiles.p50,
        p75: marketRates.percentiles.p75,
        p90: marketRates.percentiles.p90,
        average: marketRates.average,
        count: marketRates.sampleSize
      },
      trends: trends.map(t => ({
        period: t.period,
        value: t.averageRate,
        change: t.changePercent
      })),
      geographic: geographic.map(g => ({
        region: g.region,
        averageRate: g.averageRate,
        sampleSize: g.sampleSize
      })),
      comparisons: comparisons.map(c => ({
        supplier: c.supplierName,
        rate: c.rate,
        percentile: c.percentile
      }))
    };
  }
}

/**
 * Mock Data Provider for Rate Benchmarking
 */
export class RateBenchmarkingMockProvider extends MockDataProvider<RateBenchmarkingData> {
  protected generateMockData(params?: RateBenchmarkingRequest): RateBenchmarkingData {
    // Import mock data generator
    const { generateRateBenchmarkingMock } = require('../../../../apps/web/lib/mock-data/rate-benchmarking-mock');
    return generateRateBenchmarkingMock(params);
  }

  async getData(params?: RateBenchmarkingRequest): Promise<DataProviderResponse<RateBenchmarkingData>> {
    try {
      this.log('info', 'Generating mock rate benchmarking data', params);
      
      // Simulate network delay
      await this.simulateNetworkDelay();
      
      const data = this.generateMockData(params);
      
      const metadata = this.createMetadata('mock-data-generator', {
        recordCount: data.marketRates.count,
        description: 'Mock rate benchmarking data for testing'
      });
      
      return this.createResponse(data, metadata);
    } catch (error) {
      this.log('error', 'Failed to generate mock rate benchmarking data', error);
      throw error;
    }
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    return this.createMetadata('mock-data-generator', {
      description: 'Mock rate benchmarking data generator'
    });
  }
}
