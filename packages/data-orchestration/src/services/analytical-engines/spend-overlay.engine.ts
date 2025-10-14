// Spend Overlay Engine Implementation
import { dbAdaptor } from "../../dal/database.adaptor";
import { cacheAdaptor } from "../../dal/cache.adaptor";
import { analyticalEventPublisher } from "../../events/analytical-event-publisher";
import { analyticalDatabaseService } from "../analytical-database.service";
import { SpendOverlayEngine } from "../analytical-intelligence.service";
import { 
  SpendDataSource,
  SpendRecord,
  SpendMapping,
  VarianceAnalysis,
  EfficiencyMetrics,
  SpendIntegrationResult,
  MappingResult,
  SpendFilters,
  SpendReport,
  LeakageAnalysis,
  UtilizationAnalysis
} from "./spend-models";
import pino from "pino";
import crypto from "crypto";

const logger = pino({ name: "spend-overlay-engine" });

export class SpendOverlayEngineImpl implements SpendOverlayEngine {
  private dataQualityThresholds = {
    minConfidence: 0.7,
    maxVariance: 0.25,
    requiredFields: ['supplier', 'amount', 'category', 'period']
  };

  // Task 6.1: Spend Data Integration
  async integrateSpendData(source: SpendDataSource): Promise<SpendIntegrationResult> {
    try {
      logger.info({ source: source.type }, "Starting spend data integration");

      const result: SpendIntegrationResult = {
        source: source.type,
        recordsImported: 0,
        recordsSkipped: 0,
        recordsRejected: 0,
        errors: [],
        warnings: [],
        dataQualityScore: 0,
        lastSync: new Date(),
        success: false
      };

      let spendRecords: SpendRecord[] = [];

      // Fetch data based on source type
      switch (source.type) {
        case 'sievo':
          spendRecords = await this.fetchSievoData(source);
          break;
        case 'ariba':
          spendRecords = await this.fetchAribaData(source);
          break;
        case 'csv':
          spendRecords = await this.processCsvData(source);
          break;
        default:
          spendRecords = this.generateMockSpendData();
      }

      // Validate and cleanse data
      const validatedRecords = await this.validateSpendData(spendRecords, result);
      
      // Store validated records in database
      for (const record of validatedRecords) {
        try {
          await this.storeSpendRecord(record);
          result.recordsImported++;
        } catch (error) {
          result.errors.push(`Failed to store record ${record.id}: ${error}`);
          result.recordsRejected++;
        }
      }

      // Calculate data quality score
      result.dataQualityScore = this.calculateDataQualityScore(validatedRecords, result);
      result.success = result.recordsImported > 0;

      // Publish spend data imported event
      await analyticalEventPublisher.publishSpendVariance({
        tenantId: source.tenantId || 'default',
        supplierId: 'system',
        period: new Date().toISOString().substring(0, 7),
        variance: {
          contractedAmount: 0,
          actualSpend: validatedRecords.reduce((sum, r) => sum + r.amount, 0),
          varianceAmount: 0,
          variancePercentage: 0,
          offContractSpend: 0
        }
      });

      logger.info({ 
        source: source.type, 
        imported: result.recordsImported,
        quality: result.dataQualityScore 
      }, "Spend data integration completed");

      return result;

    } catch (error) {
      logger.error({ error, source: source.type }, "Failed to integrate spend data");
      throw error;
    }
  }

  // Task 6.2: Spend-to-Contract Mapping
  async mapSpendToContracts(spendData: SpendRecord[]): Promise<MappingResult> {
    try {
      logger.info({ recordCount: spendData.length }, "Starting spend-to-contract mapping");

      const result: MappingResult = {
        totalRecords: spendData.length,
        mappedRecords: 0,
        unmappedRecords: 0,
        mappings: [],
        confidence: 0,
        processingTime: 0
      };

      const startTime = Date.now();

      // Get all active contracts for mapping
      const contracts = await this.getActiveContracts();
      
      for (const spend of spendData) {
        const mapping = await this.findBestContractMatch(spend, contracts);
        
        if (mapping) {
          result.mappings.push(mapping);
          result.mappedRecords++;
        } else {
          result.unmappedRecords++;
          
          // Create unmapped record for analysis
          result.mappings.push({
            spendRecordId: spend.id,
            contractId: undefined,
            mappingConfidence: 0,
            mappingMethod: 'none',
            supplierMatch: false,
            categoryMatch: false,
            poMatch: false,
            reasons: ['No matching contract found']
          });
        }
      }

      // Calculate overall confidence
      const mappedWithConfidence = result.mappings.filter(m => m.mappingConfidence > this.dataQualityThresholds.minConfidence);
      result.confidence = result.mappedRecords > 0 ? mappedWithConfidence.length / result.mappedRecords : 0;
      result.processingTime = Date.now() - startTime;

      logger.info({ 
        mapped: result.mappedRecords, 
        unmapped: result.unmappedRecords,
        confidence: result.confidence 
      }, "Spend mapping completed");

      return result;

    } catch (error) {
      logger.error({ error }, "Failed to map spend to contracts");
      throw error;
    }
  }

  // Task 6.3: Variance Analysis
  async analyzeVariances(mappings: SpendMapping[]): Promise<VarianceAnalysis> {
    try {
      logger.info({ mappingCount: mappings.length }, "Starting variance analysis");

      // Group mappings by supplier and period
      const supplierGroups = this.groupMappingsBySupplier(mappings);
      const analyses: VarianceAnalysis[] = [];

      for (const [supplierId, supplierMappings] of supplierGroups.entries()) {
        const analysis = await this.analyzeSupplierVariance(supplierId, supplierMappings);
        analyses.push(analysis);

        // Publish variance event if significant
        if (Math.abs(analysis.variancePercentage) > 10) {
          await analyticalEventPublisher.publishSpendVariance({
            tenantId: analysis.tenantId,
            supplierId: analysis.supplierId,
            period: analysis.period,
            variance: {
              contractedAmount: analysis.contractedAmount,
              actualSpend: analysis.actualSpend,
              varianceAmount: analysis.variance,
              variancePercentage: analysis.variancePercentage,
              offContractSpend: analysis.offContractSpend
            }
          });
        }
      }

      // Calculate aggregate analysis
      const aggregateAnalysis = this.calculateAggregateVariance(analyses);

      logger.info({ 
        supplierCount: analyses.length,
        totalVariance: aggregateAnalysis.totalVariancePercentage 
      }, "Variance analysis completed");

      return aggregateAnalysis;

    } catch (error) {
      logger.error({ error }, "Failed to analyze variances");
      throw error;
    }
  }

  // Task 6.4: Efficiency Metrics Calculation
  async calculateEfficiency(supplierId: string): Promise<EfficiencyMetrics> {
    try {
      logger.info({ supplierId }, "Calculating efficiency metrics");

      // Get spend data for supplier
      const spendData = await this.getSupplierSpendData(supplierId);
      const contracts = await this.getSupplierContracts(supplierId);
      
      // Calculate utilization metrics
      const utilization = await this.calculateUtilization(supplierId, spendData, contracts);
      
      // Calculate leakage analysis
      const leakage = await this.calculateLeakage(supplierId, spendData, contracts);
      
      // Calculate cost efficiency
      const costEfficiency = this.calculateCostEfficiency(spendData, contracts);
      
      // Calculate contract compliance
      const compliance = this.calculateContractCompliance(spendData, contracts);

      const metrics: EfficiencyMetrics = {
        supplierId,
        tenantId: 'default', // Would come from context
        period: new Date().toISOString().substring(0, 7),
        utilizationRate: utilization.overallUtilization,
        costEfficiency,
        contractCompliance: compliance.overallCompliance,
        savingsRealization: this.calculateSavingsRealization(spendData, contracts),
        leakageAmount: leakage.totalLeakage,
        leakagePercentage: leakage.leakagePercentage,
        volumeCommitmentUtilization: utilization.volumeUtilization,
        rateVariance: this.calculateRateVariance(spendData, contracts),
        calculatedAt: new Date()
      };

      // Store efficiency metrics
      await this.storeEfficiencyMetrics(metrics);

      logger.info({ 
        supplierId, 
        utilizationRate: metrics.utilizationRate,
        leakagePercentage: metrics.leakagePercentage 
      }, "Efficiency calculation completed");

      return metrics;

    } catch (error) {
      logger.error({ error, supplierId }, "Failed to calculate efficiency");
      throw error;
    }
  }

  async generateSpendReport(filters: SpendFilters): Promise<SpendReport> {
    try {
      logger.info({ filters }, "Generating spend report");

      // Get spend data based on filters
      const spendData = await this.getFilteredSpendData(filters);
      const mappings = await this.mapSpendToContracts(spendData);
      const variances = await this.analyzeVariances(mappings.mappings);

      // Calculate summary metrics
      const summary = this.calculateSpendSummary(spendData, mappings, variances);
      
      // Identify top suppliers and categories
      const topSuppliers = this.getTopSuppliers(spendData);
      const topCategories = this.getTopCategories(spendData);
      
      // Calculate trends
      const trends = await this.calculateSpendTrends(filters);

      const report: SpendReport = {
        tenantId: filters.tenantId,
        period: filters.period,
        filters,
        summary,
        topSuppliers,
        topCategories,
        variances: [variances],
        trends,
        recommendations: this.generateSpendRecommendations(summary, variances),
        generatedAt: new Date()
      };

      // Cache the report
      const cacheKey = `spend-report:${JSON.stringify(filters)}`;
      await cacheAdaptor.set(cacheKey, report, 1800); // 30 minutes TTL

      logger.info({ 
        totalSpend: summary.totalSpend,
        supplierCount: topSuppliers.length 
      }, "Spend report generated");

      return report;

    } catch (error) {
      logger.error({ error, filters }, "Failed to generate spend report");
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test database connectivity
      const dbHealth = await analyticalDatabaseService.healthCheck();
      
      // Test cache connectivity
      await cacheAdaptor.set('spend-health-check', 'ok', 10);
      const cacheTest = await cacheAdaptor.get('spend-health-check');
      
      return dbHealth.success && cacheTest === 'ok';
    } catch (error) {
      logger.error({ error }, "Spend overlay engine health check failed");
      return false;
    }
  }

  // Private helper methods
  private async fetchSievoData(source: SpendDataSource): Promise<SpendRecord[]> {
    // Mock Sievo API integration
    if (!source.apiKey) {
      throw new Error('Sievo API key not configured');
    }
    
    // In production, this would make actual API calls
    return this.generateMockSpendData();
  }

  private async fetchAribaData(source: SpendDataSource): Promise<SpendRecord[]> {
    // Mock Ariba API integration
    if (!source.apiKey) {
      throw new Error('Ariba API key not configured');
    }
    
    return this.generateMockSpendData();
  }

  private async processCsvData(source: SpendDataSource): Promise<SpendRecord[]> {
    // Mock CSV processing
    if (!source.filePath) {
      throw new Error('CSV file path not provided');
    }
    
    return this.generateMockSpendData();
  }

  private generateMockSpendData(): SpendRecord[] {
    const suppliers = ['Accenture', 'Deloitte', 'PwC', 'KPMG', 'IBM', 'TCS'];
    const categories = ['IT Services', 'Consulting', 'Advisory', 'Support', 'Development'];
    const records: SpendRecord[] = [];

    for (let i = 0; i < 100; i++) {
      records.push({
        id: crypto.randomUUID(),
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        amount: 1000 + Math.random() * 50000,
        currency: 'USD',
        period: '2024-03',
        costCenter: `CC-${Math.floor(Math.random() * 100)}`,
        poReference: Math.random() > 0.7 ? `PO-${Math.floor(Math.random() * 10000)}` : undefined,
        description: `Mock spend record ${i + 1}`,
        transactionDate: new Date(),
        source: 'mock'
      });
    }

    return records;
  }

  private async validateSpendData(records: SpendRecord[], result: SpendIntegrationResult): Promise<SpendRecord[]> {
    const validRecords: SpendRecord[] = [];

    for (const record of records) {
      const validation = this.validateSpendRecord(record);
      
      if (validation.isValid) {
        validRecords.push(record);
      } else {
        result.recordsSkipped++;
        result.warnings.push(`Record ${record.id}: ${validation.errors.join(', ')}`);
      }
    }

    return validRecords;
  }

  private validateSpendRecord(record: SpendRecord): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.supplier) errors.push('Missing supplier');
    if (!record.amount || record.amount <= 0) errors.push('Invalid amount');
    if (!record.category) errors.push('Missing category');
    if (!record.period) errors.push('Missing period');

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private calculateDataQualityScore(records: SpendRecord[], result: SpendIntegrationResult): number {
    const totalRecords = result.recordsImported + result.recordsSkipped + result.recordsRejected;
    if (totalRecords === 0) return 0;

    const completenessScore = (result.recordsImported / totalRecords) * 100;
    const accuracyScore = Math.max(0, 100 - (result.errors.length / totalRecords) * 100);
    
    return Math.round((completenessScore + accuracyScore) / 2);
  }

  private async storeSpendRecord(record: SpendRecord): Promise<void> {
    // Store in analytical database
    // In production, this would use the actual database service
    logger.debug({ recordId: record.id }, "Storing spend record");
  }

  private async getActiveContracts(): Promise<any[]> {
    return await dbAdaptor.prisma.contract.findMany({
      where: { status: { not: 'DELETED' } },
      select: {
        id: true,
        supplierName: true,
        category: true,
        totalValue: true,
        startDate: true,
        endDate: true
      }
    });
  }

  private async findBestContractMatch(spend: SpendRecord, contracts: any[]): Promise<SpendMapping | null> {
    let bestMatch: SpendMapping | null = null;
    let highestConfidence = 0;

    for (const contract of contracts) {
      const mapping = this.calculateMappingScore(spend, contract);
      
      if (mapping.mappingConfidence > highestConfidence && mapping.mappingConfidence >= this.dataQualityThresholds.minConfidence) {
        highestConfidence = mapping.mappingConfidence;
        bestMatch = mapping;
      }
    }

    return bestMatch;
  }

  private calculateMappingScore(spend: SpendRecord, contract: any): SpendMapping {
    let confidence = 0;
    const reasons: string[] = [];
    let supplierMatch = false;
    let categoryMatch = false;
    let poMatch = false;

    // Supplier name matching
    if (spend.supplier && contract.supplierName) {
      const similarity = this.calculateStringSimilarity(spend.supplier.toLowerCase(), contract.supplierName.toLowerCase());
      if (similarity > 0.8) {
        confidence += 0.5;
        supplierMatch = true;
        reasons.push('Strong supplier name match');
      } else if (similarity > 0.6) {
        confidence += 0.3;
        supplierMatch = true;
        reasons.push('Partial supplier name match');
      }
    }

    // Category matching
    if (spend.category && contract.category) {
      if (spend.category.toLowerCase() === contract.category.toLowerCase()) {
        confidence += 0.3;
        categoryMatch = true;
        reasons.push('Exact category match');
      }
    }

    // PO reference matching (if available)
    if (spend.poReference) {
      // In production, would check against contract PO references
      poMatch = Math.random() > 0.7;
      if (poMatch) {
        confidence += 0.2;
        reasons.push('PO reference match');
      }
    }

    return {
      spendRecordId: spend.id,
      contractId: contract.id,
      mappingConfidence: Math.min(confidence, 1.0),
      mappingMethod: supplierMatch ? 'supplier_name' : 'category',
      supplierMatch,
      categoryMatch,
      poMatch,
      reasons
    };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private groupMappingsBySupplier(mappings: SpendMapping[]): Map<string, SpendMapping[]> {
    const groups = new Map<string, SpendMapping[]>();
    
    for (const mapping of mappings) {
      // Get supplier from spend record (would need to fetch from database)
      const supplierId = 'mock-supplier'; // Placeholder
      
      if (!groups.has(supplierId)) {
        groups.set(supplierId, []);
      }
      groups.get(supplierId)!.push(mapping);
    }
    
    return groups;
  }

  private async analyzeSupplierVariance(supplierId: string, mappings: SpendMapping[]): Promise<VarianceAnalysis> {
    // Mock variance analysis - in production would calculate actual variances
    const contractedAmount = 1000000 + Math.random() * 2000000;
    const actualSpend = contractedAmount * (0.9 + Math.random() * 0.3);
    const variance = actualSpend - contractedAmount;
    const variancePercentage = (variance / contractedAmount) * 100;

    return {
      supplierId,
      tenantId: 'default',
      period: '2024-03',
      contractedAmount,
      actualSpend,
      variance,
      variancePercentage,
      offContractSpend: Math.max(0, actualSpend * 0.1),
      rateCreep: [
        {
          category: 'IT Services',
          contractedRate: 150,
          actualRate: 160,
          variance: 10,
          volumeImpact: 5000
        }
      ],
      volumeVariance: {
        planned: 1000,
        actual: 1100,
        variance: 100
      },
      analyzedAt: new Date()
    };
  }

  private calculateAggregateVariance(analyses: VarianceAnalysis[]): VarianceAnalysis {
    if (analyses.length === 0) {
      return {
        supplierId: 'aggregate',
        tenantId: 'default',
        period: '2024-03',
        contractedAmount: 0,
        actualSpend: 0,
        variance: 0,
        variancePercentage: 0,
        offContractSpend: 0,
        rateCreep: [],
        analyzedAt: new Date()
      };
    }

    const totalContracted = analyses.reduce((sum, a) => sum + a.contractedAmount, 0);
    const totalActual = analyses.reduce((sum, a) => sum + a.actualSpend, 0);
    const totalVariance = totalActual - totalContracted;
    const totalOffContract = analyses.reduce((sum, a) => sum + (a.offContractSpend || 0), 0);

    return {
      supplierId: 'aggregate',
      tenantId: 'default',
      period: '2024-03',
      contractedAmount: totalContracted,
      actualSpend: totalActual,
      variance: totalVariance,
      variancePercentage: totalContracted > 0 ? (totalVariance / totalContracted) * 100 : 0,
      offContractSpend: totalOffContract,
      rateCreep: [],
      totalVariancePercentage: totalContracted > 0 ? (totalVariance / totalContracted) * 100 : 0,
      analyzedAt: new Date()
    };
  }

  private async getSupplierSpendData(supplierId: string): Promise<SpendRecord[]> {
    // Mock implementation - would query actual spend data
    return this.generateMockSpendData().filter(r => r.supplier.includes(supplierId));
  }

  private async getSupplierContracts(supplierId: string): Promise<any[]> {
    return await dbAdaptor.prisma.contract.findMany({
      where: {
        supplierName: { contains: supplierId },
        status: { not: 'DELETED' }
      }
    });
  }

  private async calculateUtilization(supplierId: string, spendData: SpendRecord[], contracts: any[]): Promise<UtilizationAnalysis> {
    // Mock utilization calculation
    return {
      overallUtilization: 85 + Math.random() * 15,
      volumeUtilization: 90 + Math.random() * 10,
      rateUtilization: 80 + Math.random() * 20,
      commitmentUtilization: 75 + Math.random() * 25
    };
  }

  private async calculateLeakage(supplierId: string, spendData: SpendRecord[], contracts: any[]): Promise<LeakageAnalysis> {
    const totalSpend = spendData.reduce((sum, r) => sum + r.amount, 0);
    const leakageAmount = totalSpend * (0.05 + Math.random() * 0.15); // 5-20% leakage

    return {
      totalLeakage: leakageAmount,
      leakagePercentage: (leakageAmount / totalSpend) * 100,
      offContractSpend: leakageAmount * 0.6,
      rateCreep: leakageAmount * 0.4
    };
  }

  private calculateCostEfficiency(spendData: SpendRecord[], contracts: any[]): number {
    // Mock cost efficiency calculation
    return 80 + Math.random() * 20;
  }

  private calculateContractCompliance(spendData: SpendRecord[], contracts: any[]): { overallCompliance: number } {
    // Mock compliance calculation
    return {
      overallCompliance: 90 + Math.random() * 10
    };
  }

  private calculateSavingsRealization(spendData: SpendRecord[], contracts: any[]): number {
    // Mock savings realization calculation
    return 75 + Math.random() * 25;
  }

  private calculateRateVariance(spendData: SpendRecord[], contracts: any[]): number {
    // Mock rate variance calculation
    return -5 + Math.random() * 20; // -5% to +15%
  }

  private async storeEfficiencyMetrics(metrics: EfficiencyMetrics): Promise<void> {
    // Store efficiency metrics in database
    logger.debug({ supplierId: metrics.supplierId }, "Storing efficiency metrics");
  }

  private async getFilteredSpendData(filters: SpendFilters): Promise<SpendRecord[]> {
    // Mock filtered spend data retrieval
    return this.generateMockSpendData();
  }

  private calculateSpendSummary(spendData: SpendRecord[], mappings: MappingResult, variances: VarianceAnalysis): any {
    const totalSpend = spendData.reduce((sum, r) => sum + r.amount, 0);
    
    return {
      totalSpend,
      mappedSpend: totalSpend * (mappings.mappedRecords / mappings.totalRecords),
      unmappedSpend: totalSpend * (mappings.unmappedRecords / mappings.totalRecords),
      totalVariance: variances.variance,
      variancePercentage: variances.variancePercentage,
      supplierCount: new Set(spendData.map(r => r.supplier)).size,
      categoryCount: new Set(spendData.map(r => r.category)).size
    };
  }

  private getTopSuppliers(spendData: SpendRecord[]): Array<{ supplier: string; amount: number; percentage: number }> {
    const supplierTotals = new Map<string, number>();
    const totalSpend = spendData.reduce((sum, r) => sum + r.amount, 0);

    for (const record of spendData) {
      supplierTotals.set(record.supplier, (supplierTotals.get(record.supplier) || 0) + record.amount);
    }

    return Array.from(supplierTotals.entries())
      .map(([supplier, amount]) => ({
        supplier,
        amount,
        percentage: (amount / totalSpend) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }

  private getTopCategories(spendData: SpendRecord[]): Array<{ category: string; amount: number; percentage: number }> {
    const categoryTotals = new Map<string, number>();
    const totalSpend = spendData.reduce((sum, r) => sum + r.amount, 0);

    for (const record of spendData) {
      categoryTotals.set(record.category, (categoryTotals.get(record.category) || 0) + record.amount);
    }

    return Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: (amount / totalSpend) * 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }

  private async calculateSpendTrends(filters: SpendFilters): Promise<Array<{ period: string; amount: number; change: number }>> {
    // Mock trend calculation
    return [
      { period: '2024-01', amount: 2000000, change: 5.2 },
      { period: '2024-02', amount: 2100000, change: 5.0 },
      { period: '2024-03', amount: 2200000, change: 4.8 }
    ];
  }

  private generateSpendRecommendations(summary: any, variances: VarianceAnalysis): string[] {
    const recommendations = [];

    if (Math.abs(variances.variancePercentage) > 15) {
      recommendations.push('Investigate significant spend variance and implement controls');
    }

    if (summary.unmappedSpend / summary.totalSpend > 0.2) {
      recommendations.push('Improve spend-to-contract mapping to reduce unmapped spend');
    }

    if (variances.offContractSpend && variances.offContractSpend > summary.totalSpend * 0.1) {
      recommendations.push('Address off-contract spend through better procurement controls');
    }

    recommendations.push('Implement regular spend analysis and monitoring');
    recommendations.push('Consider contract optimization opportunities');

    return recommendations;
  }
}