/**
 * Renewal Radar Data Providers
 * 
 * This module provides real and mock data providers for renewal radar functionality.
 */

import { RealDataProvider, MockDataProvider } from './base-data-provider';
import {
  RenewalRadarData,
  RenewalRadarRequest,
  DataProviderResponse,
  DataSourceMetadata
} from '../types/data-provider.types';

/**
 * Real Data Provider for Renewal Radar
 */
export class RenewalRadarRealProvider extends RealDataProvider<RenewalRadarData> {
  protected async checkServiceHealth(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      this.log('error', 'Renewal radar service health check failed', error);
      return false;
    }
  }

  async getData(params?: RenewalRadarRequest): Promise<DataProviderResponse<RenewalRadarData>> {
    try {
      this.log('info', 'Fetching real renewal radar data', params);
      
      const data = await this.executeWithRetry(
        () => this.fetchRealData(params),
        'renewal-radar-fetch'
      );
      
      const metadata = this.createMetadata('renewal-database', {
        description: 'Real contract renewal data from database'
      });
      
      return this.createResponse(data, metadata);
    } catch (error) {
      this.log('error', 'Failed to fetch real renewal radar data', error);
      throw error;
    }
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    return this.createMetadata('renewal-database', {
      description: 'Real-time contract renewal tracking data'
    });
  }

  private async fetchRealData(params?: RenewalRadarRequest): Promise<RenewalRadarData> {
    // Import existing renewal radar engine
    const { RenewalRadarEngineImpl } = await import('../services/analytical-engines/renewal-radar.engine');
    
    const engine = new RenewalRadarEngineImpl();
    
    // Determine timeframe in days
    const timeframeDays = params?.timeframe === '3months' ? 90 :
                          params?.timeframe === '6months' ? 180 : 365;
    
    // Fetch upcoming renewals
    const renewals = await engine.getUpcomingRenewals(timeframeDays);
    
    // Filter by risk level if specified
    let filteredRenewals = renewals;
    if (params?.riskLevel) {
      filteredRenewals = renewals.filter(r => r.riskLevel === params.riskLevel);
    }
    
    // Transform to our format
    const upcomingRenewals = filteredRenewals.map(r => ({
      contractId: r.contractId,
      supplier: r.supplierName,
      renewalDate: new Date(r.renewalDate),
      value: r.contractValue,
      riskLevel: r.riskLevel as 'high' | 'medium' | 'low',
      autoRenewal: r.hasAutoRenewal,
      noticePeriod: r.noticePeriodDays
    }));
    
    // Calculate risk analysis
    const riskAnalysis = {
      totalContracts: upcomingRenewals.length,
      totalValue: upcomingRenewals.reduce((sum, r) => sum + r.value, 0),
      riskDistribution: upcomingRenewals.reduce((acc, r) => {
        acc[r.riskLevel] = (acc[r.riskLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    // Generate action items
    const actionItems = await engine.generateActionItems(filteredRenewals);
    
    return {
      upcomingRenewals,
      riskAnalysis,
      actionItems: actionItems.map(a => ({
        contractId: a.contractId,
        action: a.action,
        dueDate: new Date(a.dueDate),
        priority: a.priority as 'high' | 'medium' | 'low'
      }))
    };
  }
}

/**
 * Mock Data Provider for Renewal Radar
 */
export class RenewalRadarMockProvider extends MockDataProvider<RenewalRadarData> {
  protected generateMockData(params?: RenewalRadarRequest): RenewalRadarData {
    const { generateRenewalRadarMock } = require('../../../../apps/web/lib/mock-data/renewal-radar-mock');
    return generateRenewalRadarMock(params);
  }

  async getData(params?: RenewalRadarRequest): Promise<DataProviderResponse<RenewalRadarData>> {
    try {
      this.log('info', 'Generating mock renewal radar data', params);
      
      await this.simulateNetworkDelay();
      
      const data = this.generateMockData(params);
      
      const metadata = this.createMetadata('mock-data-generator', {
        description: 'Mock renewal radar data for testing'
      });
      
      return this.createResponse(data, metadata);
    } catch (error) {
      this.log('error', 'Failed to generate mock renewal radar data', error);
      throw error;
    }
  }

  async getMetadata(): Promise<DataSourceMetadata> {
    return this.createMetadata('mock-data-generator', {
      description: 'Mock renewal radar data generator'
    });
  }
}
