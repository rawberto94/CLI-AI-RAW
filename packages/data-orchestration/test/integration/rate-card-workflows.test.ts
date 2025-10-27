/**
 * Integration Tests for Rate Card Benchmarking Module
 * Tests complete end-to-end workflows
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from 'clients-db';
import { RateCardEntryService } from '../../src/services/rate-card-entry.service';
import { RateCardExtractionService } from '../../src/services/rate-card-extraction.service';
import { RateCardBenchmarkingEngine } from '../../src/services/rate-card-benchmarking.service';
import { CSVImportService } from '../../src/services/csv-import.service';
import { MarketIntelligenceService } from '../../src/services/market-intelligence.service';
import { SavingsOpportunityService } from '../../src/services/savings-opportunity.service';
import { NegotiationAssistantService } from '../../src/services/negotiation-assistant.service';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'test-tenant-integration';
const TEST_USER_ID = 'test-user-integration';

describe('Rate Card Integration Tests', () => {
  let entryService: RateCardEntryService;
  let extractionService: RateCardExtractionService;
  let benchmarkingEngine: RateCardBenchmarkingEngine;
  let csvImportService: CSVImportService;
  let marketIntelService: MarketIntelligenceService;
  let savingsService: SavingsOpportunityService;
  let negotiationService: NegotiationAssistantService;

  beforeAll(async () => {
    // Initialize services
    entryService = new RateCardEntryService(prisma);
    extractionService = new RateCardExtractionService(prisma);
    benchmarkingEngine = new RateCardBenchmarkingEngine(prisma);
    csvImportService = new CSVImportService(prisma);
    marketIntelService = new MarketIntelligenceService(prisma);
    savingsService = new SavingsOpportunityService(prisma);
    negotiationService = new NegotiationAssistantService(prisma);

    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      create: {
        id: TEST_TENANT_ID,
        name: 'Test Tenant Integration',
        slug: 'test-tenant-integration',
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.rateCardEntry.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.rateCardSupplier.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.benchmarkSnapshot.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.rateSavingsOpportunity.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.delete({ where: { id: TEST_TENANT_ID } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up between tests
    await prisma.rateCardEntry.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.benchmarkSnapshot.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  });

  describe('End-to-End Workflow: Manual Entry → Benchmark → Savings Detection', () => {
    it('should complete full workflow from entry to savings opportunity', async () => {
      // Step 1: Create multiple rate card entries to build cohort
      const entries = await Promise.all([
        entryService.createEntry({
          source: 'MANUAL',
          supplierName: 'Supplier A',
          supplierTier: 'TIER_1',
          supplierCountry: 'USA',
          roleOriginal: 'Senior Software Engineer',
          roleStandardized: 'Software Engineer',
          seniority: 'SENIOR',
          lineOfService: 'Technology',
          roleCategory: 'Engineering',
          dailyRate: 1200,
          currency: 'USD',
          country: 'USA',
          region: 'North America',
          effectiveDate: new Date('2024-01-01'),
          isNegotiated: true,
        }, TEST_TENANT_ID, TEST_USER_ID),
        
        entryService.createEntry({
          source: 'MANUAL',
          supplierName: 'Supplier B',
          supplierTier: 'TIER_2',
          supplierCountry: 'USA',
          roleOriginal: 'Sr. Software Engineer',
          roleStandardized: 'Software Engineer',
          seniority: 'SENIOR',
          lineOfService: 'Technology',
          roleCategory: 'Engineering',
          dailyRate: 1000,
          currency: 'USD',
          country: 'USA',
          region: 'North America',
          effectiveDate: new Date('2024-01-15'),
          isNegotiated: false,
        }, TEST_TENANT_ID, TEST_USER_ID),
        
        entryService.createEntry({
          source: 'MANUAL',
          supplierName: 'Supplier C',
          supplierTier: 'TIER_1',
          supplierCountry: 'USA',
          roleOriginal: 'Senior Developer',
          roleStandardized: 'Software Engineer',
          seniority: 'SENIOR',
          lineOfService: 'Technology',
          roleCategory: 'Engineering',
          dailyRate: 1500, // High rate - should trigger opportunity
          currency: 'USD',
          country: 'USA',
          region: 'North America',
          effectiveDate: new Date('2024-02-01'),
          isNegotiated: false,
        }, TEST_TENANT_ID, TEST_USER_ID),
      ]);

      expect(entries).toHaveLength(3);
      entries.forEach(entry => {
        expect(entry.id).toBeDefined();
        expect(entry.dailyRateUSD).toBeDefined();
      });

      // Step 2: Calculate benchmarks for all entries
      const benchmarks = await Promise.all(
        entries.map(entry => benchmarkingEngine.calculateBenchmark(entry.id))
      );

      expect(benchmarks).toHaveLength(3);
      benchmarks.forEach(benchmark => {
        expect(benchmark.percentileRank).toBeDefined();
        expect(benchmark.marketPosition).toBeDefined();
        expect(benchmark.cohortSize).toBeGreaterThanOrEqual(3);
      });

      // Step 3: Detect savings opportunities
      const opportunities = await savingsService.detectOpportunities(TEST_TENANT_ID, {
        minSavingsPercent: 10,
      });

      expect(opportunities.length).toBeGreaterThan(0);
      const highRateOpportunity = opportunities.find(
        opp => opp.rateCardEntryId === entries[2].id
      );
      expect(highRateOpportunity).toBeDefined();
      expect(highRateOpportunity?.potentialAnnualSavings).toBeGreaterThan(0);

      // Step 4: Generate negotiation brief
      const negotiationBrief = await negotiationService.generateNegotiationBrief(entries[2].id);
      
      expect(negotiationBrief.currentSituation).toBeDefined();
      expect(negotiationBrief.marketPosition).toBeDefined();
      expect(negotiationBrief.targetRates).toBeDefined();
      expect(negotiationBrief.talkingPoints.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('End-to-End Workflow: CSV Upload → Validation → Import → Benchmark', () => {
    it('should handle bulk CSV import with validation and benchmarking', async () => {
      // Step 1: Create CSV data
      const csvData = `supplierName,roleOriginal,roleStandardized,seniority,lineOfService,dailyRate,currency,country,region,effectiveDate
Supplier D,Project Manager,Project Manager,SENIOR,Consulting,800,USD,USA,North America,2024-01-01
Supplier E,Sr. Project Manager,Project Manager,SENIOR,Consulting,900,USD,USA,North America,2024-01-15
Supplier F,Lead PM,Project Manager,SENIOR,Consulting,1100,USD,USA,North America,2024-02-01`;

      // Step 2: Parse CSV
      const parseResult = await csvImportService.parseCSV(csvData, TEST_TENANT_ID);
      
      expect(parseResult.summary.totalRows).toBe(3);
      expect(parseResult.summary.validRows).toBe(3);
      expect(parseResult.errors.length).toBe(0);

      // Step 3: Preview import
      const preview = await csvImportService.previewImport(
        parseResult.rows,
        TEST_TENANT_ID
      );

      expect(preview.validEntries.length).toBe(3);
      expect(preview.invalidEntries.length).toBe(0);

      // Step 4: Execute import
      const importResult = await csvImportService.executeBulkImport(
        parseResult.rows,
        TEST_TENANT_ID,
        TEST_USER_ID,
        { skipDuplicates: false }
      );

      expect(importResult.success).toBe(true);
      expect(importResult.imported).toBe(3);
      expect(importResult.rateCardIds.length).toBe(3);

      // Step 5: Verify benchmarks were calculated
      const benchmarks = await Promise.all(
        importResult.rateCardIds.map(id => 
          benchmarkingEngine.calculateBenchmark(id)
        )
      );

      expect(benchmarks.length).toBe(3);
      benchmarks.forEach(benchmark => {
        expect(benchmark.percentileRank).toBeDefined();
      });
    }, 30000);
  });

  describe('Performance: Large Dataset Handling', () => {
    it('should handle 100+ rate card entries efficiently', async () => {
      const startTime = Date.now();
      
      // Create 100 entries
      const entries = [];
      for (let i = 0; i < 100; i++) {
        entries.push({
          source: 'MANUAL' as const,
          supplierName: `Supplier ${i}`,
          supplierTier: 'TIER_2' as const,
          supplierCountry: 'USA',
          roleOriginal: 'Consultant',
          roleStandardized: 'Consultant',
          seniority: 'SENIOR' as const,
          lineOfService: 'Consulting',
          roleCategory: 'Consulting',
          dailyRate: 800 + (i * 10),
          currency: 'USD',
          country: 'USA',
          region: 'North America',
          effectiveDate: new Date('2024-01-01'),
          isNegotiated: false,
        });
      }

      // Batch create
      const created = await Promise.all(
        entries.map(entry => 
          entryService.createEntry(entry, TEST_TENANT_ID, TEST_USER_ID)
        )
      );

      const createTime = Date.now() - startTime;
      expect(created.length).toBe(100);
      expect(createTime).toBeLessThan(30000); // Should complete in 30 seconds

      // Batch benchmark calculation
      const benchmarkStart = Date.now();
      await benchmarkingEngine.batchCalculateBenchmarks(
        created.map(e => e.id)
      );
      const benchmarkTime = Date.now() - benchmarkStart;
      
      expect(benchmarkTime).toBeLessThan(20000); // Should complete in 20 seconds
    }, 60000);
  });

  describe('Market Intelligence Calculations', () => {
    it('should calculate market intelligence with sufficient data', async () => {
      // Create diverse dataset
      const roles = ['Software Engineer', 'Project Manager', 'Business Analyst'];
      const countries = ['USA', 'UK', 'India'];
      
      for (const role of roles) {
        for (const country of countries) {
          for (let i = 0; i < 5; i++) {
            await entryService.createEntry({
              source: 'MANUAL',
              supplierName: `Supplier ${role}-${country}-${i}`,
              supplierTier: 'TIER_2',
              supplierCountry: country,
              roleOriginal: role,
              roleStandardized: role,
              seniority: 'SENIOR',
              lineOfService: 'Technology',
              roleCategory: 'Engineering',
              dailyRate: 800 + (i * 100),
              currency: 'USD',
              country,
              region: country === 'USA' ? 'North America' : country === 'UK' ? 'Europe' : 'Asia',
              effectiveDate: new Date('2024-01-01'),
              isNegotiated: false,
            }, TEST_TENANT_ID, TEST_USER_ID);
          }
        }
      }

      // Calculate market intelligence
      const intelligence = await marketIntelService.calculateMarketIntelligence({
        roleStandardized: 'Software Engineer',
        seniority: 'SENIOR',
        periodMonths: 12,
      }, TEST_TENANT_ID);

      expect(intelligence.statistics.average).toBeDefined();
      expect(intelligence.statistics.median).toBeDefined();
      expect(intelligence.statistics.sampleSize).toBeGreaterThanOrEqual(15);
      expect(intelligence.byCountry.length).toBeGreaterThan(0);
    }, 30000);
  });
});
