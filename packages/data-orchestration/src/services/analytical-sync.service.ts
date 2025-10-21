/**
 * Analytical Sync Service
 * 
 * Bridges the gap between artifacts and analytical engines
 * Transforms artifact data into analytical format and syncs to analytical database
 */

import { analyticalDatabaseService } from './analytical-database.service';
import { analyticalIntelligenceService } from './analytical-intelligence.service';
import { analyticalEventPublisher } from '../events/analytical-event-publisher';
import pino from 'pino';

const logger = pino({ name: 'analytical-sync-service' });

export interface ArtifactData {
  contractId: string;
  tenantId: string;
  artifacts: any[];
  userId?: string;
}

export interface SyncResult {
  success: boolean;
  synced: {
    rateCards: number;
    renewals: number;
    compliance: number;
    suppliers: number;
    spend: number;
  };
  errors: string[];
  processingTime: number;
}

export class AnalyticalSyncService {
  private static instance: AnalyticalSyncService;

  private constructor() {
    logger.info('Analytical Sync Service initialized');
  }

  static getInstance(): AnalyticalSyncService {
    if (!AnalyticalSyncService.instance) {
      AnalyticalSyncService.instance = new AnalyticalSyncService();
    }
    return AnalyticalSyncService.instance;
  }

  /**
   * Main sync method - called when artifacts are generated
   */
  async syncArtifactsToAnalyticalEngines(data: ArtifactData): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      synced: {
        rateCards: 0,
        renewals: 0,
        compliance: 0,
        suppliers: 0,
        spend: 0,
      },
      errors: [],
      processingTime: 0,
    };

    try {
      logger.info(
        { contractId: data.contractId, artifactsCount: data.artifacts?.length || 0 },
        'Starting analytical sync'
      );

      // Extract structured data from artifacts
      const extractedData = this.extractDataFromArtifacts(data.artifacts);

      // Sync to each analytical engine in parallel
      const syncPromises = [
        this.syncRateCards(data.contractId, data.tenantId, extractedData),
        this.syncRenewals(data.contractId, data.tenantId, extractedData),
        this.syncCompliance(data.contractId, data.tenantId, extractedData),
        this.syncSuppliers(data.contractId, data.tenantId, extractedData),
        this.syncSpend(data.contractId, data.tenantId, extractedData),
      ];

      const results = await Promise.allSettled(syncPromises);

      // Process results
      results.forEach((res, index) => {
        if (res.status === 'fulfilled' && res.value) {
          const engineName = ['rateCards', 'renewals', 'compliance', 'suppliers', 'spend'][index];
          result.synced[engineName as keyof typeof result.synced] = res.value;
        } else if (res.status === 'rejected') {
          const engineName = ['Rate Cards', 'Renewals', 'Compliance', 'Suppliers', 'Spend'][index];
          result.errors.push(`${engineName}: ${res.reason}`);
          logger.error({ error: res.reason, engine: engineName }, 'Engine sync failed');
        }
      });

      result.processingTime = Date.now() - startTime;
      result.success = result.errors.length === 0;

      logger.info(
        {
          contractId: data.contractId,
          synced: result.synced,
          errors: result.errors.length,
          processingTime: result.processingTime,
        },
        'Analytical sync completed'
      );

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.processingTime = Date.now() - startTime;

      logger.error({ error, contractId: data.contractId }, 'Analytical sync failed');
      return result;
    }
  }

  /**
   * Extract structured data from artifacts
   */
  private extractDataFromArtifacts(artifacts: any[]): any {
    const data: any = {
      overview: null,
      financial: null,
      clauses: [],
      rates: [],
      compliance: null,
      risk: null,
      parties: [],
      dates: {},
    };

    if (!artifacts || !Array.isArray(artifacts)) {
      return data;
    }

    for (const artifact of artifacts) {
      try {
        const content = typeof artifact.content === 'string' 
          ? JSON.parse(artifact.content) 
          : artifact.content;

        switch (artifact.type?.toUpperCase()) {
          case 'OVERVIEW':
            data.overview = content;
            if (content.parties) data.parties = content.parties;
            if (content.effectiveDate) data.dates.effectiveDate = content.effectiveDate;
            if (content.expirationDate) data.dates.expirationDate = content.expirationDate;
            break;

          case 'FINANCIAL':
            data.financial = content;
            break;

          case 'CLAUSES':
            data.clauses = content.clauses || [];
            break;

          case 'RATES':
            data.rates = content.rateCards || content.rates || [];
            break;

          case 'COMPLIANCE':
            data.compliance = content;
            break;

          case 'RISK':
            data.risk = content;
            break;

          case 'PARTIES':
            if (content.name) {
              data.parties.push(content);
            }
            break;
        }
      } catch (error) {
        logger.warn({ error, artifactType: artifact.type }, 'Failed to parse artifact');
      }
    }

    return data;
  }

  /**
   * Sync rate cards to Rate Card Benchmarking Engine
   */
  private async syncRateCards(contractId: string, tenantId: string, data: any): Promise<number> {
    try {
      if (!data.rates || data.rates.length === 0) {
        return 0;
      }

      const rateCardEngine = analyticalIntelligenceService.getRateCardEngine();
      
      // Parse rate cards from contract
      const parseResult = await rateCardEngine.parseRateCards(contractId);
      
      if (!parseResult || !parseResult.rates) {
        return 0;
      }

      // Calculate benchmarks for each rate
      let benchmarkedCount = 0;
      for (const rate of parseResult.rates) {
        try {
          const cohort = {
            role: rate.role || 'general',
            level: rate.level || 'mid',
            region: rate.region || 'global',
            deliveryModel: rate.deliveryModel || 'onsite',
          };

          await rateCardEngine.calculateBenchmarks([rate], cohort);
          benchmarkedCount++;

          // Publish event
          await analyticalEventPublisher.publishRateCardParsed({
            tenantId,
            contractId,
            supplierId: data.overview?.parties?.[0]?.name || 'unknown',
            rateCard: {
              id: `rate-${contractId}`,
              totalRates: parseResult.rates.length,
              currency: rate.currency || 'USD',
              region: cohort.region,
              deliveryModel: cohort.deliveryModel,
            },
            cohort,
          });
        } catch (error) {
          logger.warn({ error, rate }, 'Failed to benchmark rate');
        }
      }

      logger.info({ contractId, ratesCount: benchmarkedCount }, 'Rate cards synced');
      return benchmarkedCount;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to sync rate cards');
      throw error;
    }
  }

  /**
   * Sync renewals to Renewal Radar Engine
   */
  private async syncRenewals(contractId: string, tenantId: string, data: any): Promise<number> {
    try {
      if (!data.dates?.expirationDate) {
        return 0;
      }

      const renewalEngine = analyticalIntelligenceService.getRenewalEngine();
      
      // Extract renewal data
      const renewalData = await renewalEngine.extractRenewalData(contractId);
      
      if (!renewalData) {
        return 0;
      }

      // Schedule alerts
      await renewalEngine.scheduleAlerts(renewalData);

      // Publish event
      const expirationDate = new Date(data.dates.expirationDate);
      const daysUntilDue = Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (daysUntilDue < 30) priority = 'critical';
      else if (daysUntilDue < 60) priority = 'high';
      else if (daysUntilDue < 90) priority = 'medium';

      await analyticalEventPublisher.publishRenewalAlert({
        tenantId,
        contractId,
        alertType: 'renewal',
        dueDate: expirationDate,
        daysUntilDue,
        priority,
        supplier: data.parties?.[0]?.name || 'Unknown',
        contractValue: data.financial?.totalValue || 0,
      });

      logger.info({ contractId, expirationDate, daysUntilDue }, 'Renewal synced');
      return 1;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to sync renewals');
      throw error;
    }
  }

  /**
   * Sync compliance to Clause Compliance Engine
   */
  private async syncCompliance(contractId: string, tenantId: string, data: any): Promise<number> {
    try {
      if (!data.clauses || data.clauses.length === 0) {
        return 0;
      }

      const complianceEngine = analyticalIntelligenceService.getComplianceEngine();
      
      // Scan contract for compliance
      const complianceResult = await complianceEngine.scanContract(contractId);
      
      if (!complianceResult) {
        return 0;
      }

      // Publish event
      await analyticalEventPublisher.publishComplianceScored({
        tenantId,
        contractId,
        supplierId: data.parties?.[0]?.name || 'unknown',
        complianceScore: {
          overallScore: complianceResult.overallScore || 0,
          riskLevel: complianceResult.riskLevel || 'medium',
          criticalIssues: complianceResult.criticalIssues || 0,
          clauseResults: complianceResult.clauseResults || [],
        },
      });

      logger.info({ contractId, clausesCount: data.clauses.length }, 'Compliance synced');
      return data.clauses.length;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to sync compliance');
      throw error;
    }
  }

  /**
   * Sync suppliers to Supplier Snapshot Engine
   */
  private async syncSuppliers(contractId: string, tenantId: string, data: any): Promise<number> {
    try {
      if (!data.parties || data.parties.length === 0) {
        return 0;
      }

      const supplierEngine = analyticalIntelligenceService.getSupplierEngine();
      
      let syncedCount = 0;
      for (const party of data.parties) {
        if (party.role === 'supplier' || party.role === 'vendor') {
          try {
            // Aggregate supplier data
            const supplierData = await supplierEngine.aggregateSupplierData(party.name);
            
            // Calculate metrics
            await supplierEngine.calculateSupplierMetrics(supplierData);

            // Publish event
            await analyticalEventPublisher.publishSupplierProfileUpdated({
              tenantId,
              supplierId: party.name,
              updateType: 'performance',
              changes: {
                contractId,
                totalValue: data.financial?.totalValue || 0,
                riskScore: data.risk?.overallScore || 0,
              },
            });

            syncedCount++;
          } catch (error) {
            logger.warn({ error, supplier: party.name }, 'Failed to sync supplier');
          }
        }
      }

      logger.info({ contractId, suppliersCount: syncedCount }, 'Suppliers synced');
      return syncedCount;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to sync suppliers');
      throw error;
    }
  }

  /**
   * Sync spend to Spend Overlay Engine
   */
  private async syncSpend(contractId: string, tenantId: string, data: any): Promise<number> {
    try {
      if (!data.financial) {
        return 0;
      }

      const spendEngine = analyticalIntelligenceService.getSpendEngine();
      
      // Map spend to contracts
      const spendData = [{
        contractId,
        amount: data.financial.totalValue || 0,
        currency: data.financial.currency || 'USD',
        period: 'annual',
        supplier: data.parties?.[0]?.name || 'unknown',
      }];

      await spendEngine.mapSpendToContracts(spendData);

      // Analyze variances
      const mappings = await spendEngine.analyzeVariances(spendData);

      logger.info({ contractId, spendAmount: data.financial.totalValue }, 'Spend synced');
      return 1;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to sync spend');
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if analytical intelligence service is available
      const healthStatus = await analyticalIntelligenceService.getAnalyticalHealthStatus();
      return healthStatus.success === true;
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return false;
    }
  }
}

export const analyticalSyncService = AnalyticalSyncService.getInstance();
