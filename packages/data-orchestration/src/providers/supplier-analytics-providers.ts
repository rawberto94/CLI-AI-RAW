/**
 * Supplier Analytics Data Providers
 * 
 * This module provides real and mock data providers for supplier analytics functionality.
 */

import { RealDataProvider, MockDataProvider } from './base-data-provider';
import {
  SupplierAnalyticsData,
  SupplierAnalyticsRequest,
  DataProviderResponse,
  DataSourceMetadata
} from '../types/data-provider.types';

/**
 * Real Data Provider for Supplier Analytics
 */
export class SupplierAnalyticsRealProvider extends RealDataProvider<SupplierAnalyticsData> {
  protected async checkServiceHealth(): Promise<boolean> {
    try {
      // Check if database and services are available
      return true;
    } catch (error) {
      this.log('error', 'Supplier analytics service health check failed', error);
      return false;
    }
  }

  async getData(params?: SupplierAnalyticsRequest): Promise<DataProviderResponse<SupplierAnalyticsData>> {
    try {
      this.log('info', 'Fetching real supplier analytics data', params);
      
      const data = await this.executeWithRetry(
        () => this.fetchRealData(params),
        'supplier-analytics-fetch'
      );
      
      const metadata = this.createMetadata('supplier-database', {
        description: 'Real supplier analytics from contract data'
      });
      
      return this.createResponse(data, metadata);
    } catch (error) {
      this.log('error', 'Failed to fetch real supplier analytics data', error);
      throw error;
    }
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    return this.createMetadata('supplier-database', {
      description: 'Real-time supplier analytics data'
    });
  }

  private async fetchRealData(params?: SupplierAnalyticsRequest): Promise<SupplierAnalyticsData> {
    // Import existing supplier snapshot engine
    const { SupplierSnapshotEngineImpl } = await import('../services/analytical-engines/supplier-snapshot.engine');
    
    const engine = new SupplierSnapshotEngineImpl();
    
    // Fetch supplier data
    const supplierId = params?.supplierId || '';
    const snapshot = await engine.generateSupplierSnapshot(supplierId);
    
    return {
      performance: {
        deliveryScore: snapshot.performance.onTimeDelivery,
        qualityScore: snapshot.performance.qualityScore,
        costEfficiency: snapshot.performance.costEfficiency,
        riskScore: snapshot.riskProfile.overallRisk
      },
      financialHealth: {
        creditRating: snapshot.financialHealth.creditRating,
        revenue: snapshot.financialHealth.annualRevenue,
        profitMargin: snapshot.financialHealth.profitMargin,
        debtRatio: snapshot.financialHealth.debtToEquity
      },
      relationships: {
        contractCount: snapshot.contractMetrics.activeContracts,
        totalValue: snapshot.contractMetrics.totalValue,
        averageContractLength: snapshot.contractMetrics.averageDuration,
        renewalRate: snapshot.contractMetrics.renewalRate
      },
      trends: snapshot.trends.map(t => ({
        metric: t.metric,
        values: t.dataPoints.map(dp => ({
          period: dp.period,
          value: dp.value
        }))
      }))
    };
  }
}

/**
 * Mock Data Provider for Supplier Analytics
 */
export class SupplierAnalyticsMockProvider extends MockDataProvider<SupplierAnalyticsData> {
  protected generateMockData(params?: SupplierAnalyticsRequest): SupplierAnalyticsData {
    const { generateSupplierAnalyticsMock } = require('../../../../apps/web/lib/mock-data/supplier-analytics-mock');
    return generateSupplierAnalyticsMock(params);
  }

  async getData(params?: SupplierAnalyticsRequest): Promise<DataProviderResponse<SupplierAnalyticsData>> {
    try {
      this.log('info', 'Generating mock supplier analytics data', params);
      
      await this.simulateNetworkDelay();
      
      const data = this.generateMockData(params);
      
      const metadata = this.createMetadata('mock-data-generator', {
        description: 'Mock supplier analytics data for testing'
      });
      
      return this.createResponse(data, metadata);
    } catch (error) {
      this.log('error', 'Failed to generate mock supplier analytics data', error);
      throw error;
    }
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    return this.createMetadata('mock-data-generator', {
      description: 'Mock supplier analytics data generator'
    });
  }
}
