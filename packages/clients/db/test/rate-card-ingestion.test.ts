import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseManager } from '../index';
import {
  ImportJobRepository,
  RateCardRepository,
  RoleRateRepository,
  MappingTemplateRepository,
} from '../src/repositories';

describe('Rate Card Ingestion Repositories', () => {
  let dbManager: DatabaseManager;
  let importJobRepo: ImportJobRepository;
  let rateCardRepo: RateCardRepository;
  let roleRateRepo: RoleRateRepository;
  let mappingTemplateRepo: MappingTemplateRepository;

  const testTenantId = 'test-tenant-' + Date.now();

  beforeAll(async () => {
    dbManager = new DatabaseManager();
    await dbManager.connect();

    importJobRepo = new ImportJobRepository(dbManager);
    rateCardRepo = new RateCardRepository(dbManager);
    roleRateRepo = new RoleRateRepository(dbManager);
    mappingTemplateRepo = new MappingTemplateRepository(dbManager);
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await dbManager.getClient().importJob.deleteMany({
        where: { tenantId: testTenantId },
      });
      await dbManager.getClient().mappingTemplate.deleteMany({
        where: { tenantId: testTenantId },
      });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    await dbManager.disconnect();
  });

  describe('ImportJobRepository', () => {
    it('should create an import job', async () => {
      const job = await importJobRepo.create({
        tenantId: testTenantId,
        source: 'UPLOAD',
        status: 'PENDING',
        priority: 'NORMAL',
        fileType: 'XLSX',
        fileName: 'test-rates.xlsx',
        fileSize: BigInt(1024),
        extractedData: {
          rows: [],
          totalRows: 0,
        },
        columnMappings: [],
        mappingConfidence: 0,
        rowsProcessed: 0,
        rowsSucceeded: 0,
        rowsFailed: 0,
        errors: [],
        warnings: [],
        requiresReview: false,
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.tenantId).toBe(testTenantId);
      expect(job.status).toBe('PENDING');
    });

    it('should find pending jobs', async () => {
      const jobs = await importJobRepo.findPendingJobs(testTenantId, 10);
      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThan(0);
    });

    it('should update job status', async () => {
      const job = await importJobRepo.create({
        tenantId: testTenantId,
        source: 'UPLOAD',
        status: 'PENDING',
        priority: 'NORMAL',
        fileType: 'CSV',
        extractedData: { rows: [], totalRows: 0 },
        columnMappings: [],
        mappingConfidence: 0,
        rowsProcessed: 0,
        rowsSucceeded: 0,
        rowsFailed: 0,
        errors: [],
        warnings: [],
        requiresReview: false,
      });

      const updated = await importJobRepo.updateStatus(job.id, 'PROCESSING', {
        startedAt: new Date(),
      });

      expect(updated.status).toBe('PROCESSING');
      expect(updated.startedAt).toBeDefined();
    });
  });

  describe('MappingTemplateRepository', () => {
    it('should create a mapping template', async () => {
      const template = await mappingTemplateRepo.create({
        tenantId: testTenantId,
        name: 'Test Template',
        description: 'A test mapping template',
        mappings: [
          {
            sourceColumn: 'Role',
            targetField: 'role',
            confidence: 1.0,
            transformationType: 'direct',
            examples: ['Developer'],
          },
        ],
        requiredFields: ['role', 'rate'],
        optionalFields: ['location'],
        headerPatterns: ['role', 'rate', 'location'],
        usageCount: 0,
        successRate: 0,
        version: 1,
        createdBy: 'test-user',
      });

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
    });

    it('should find templates by tenant', async () => {
      const templates = await mappingTemplateRepo.findByTenant(testTenantId);
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should increment usage count', async () => {
      const template = await mappingTemplateRepo.create({
        tenantId: testTenantId,
        name: 'Usage Test Template',
        description: 'Test usage tracking',
        mappings: [],
        requiredFields: [],
        optionalFields: [],
        headerPatterns: [],
        usageCount: 0,
        successRate: 0,
        version: 1,
        createdBy: 'test-user',
      });

      const updated = await mappingTemplateRepo.incrementUsage(template.id);
      expect(updated.usageCount).toBe(1);
      expect(updated.lastUsed).toBeDefined();
    });
  });

  describe('RateCardRepository', () => {
    it('should create a rate card with import job', async () => {
      // First create an import job
      const job = await importJobRepo.create({
        tenantId: testTenantId,
        source: 'UPLOAD',
        status: 'COMPLETED',
        priority: 'NORMAL',
        fileType: 'XLSX',
        extractedData: { rows: [], totalRows: 0 },
        columnMappings: [],
        mappingConfidence: 0,
        rowsProcessed: 0,
        rowsSucceeded: 0,
        rowsFailed: 0,
        errors: [],
        warnings: [],
        requiresReview: false,
      });

      // Create rate card
      const rateCard = await rateCardRepo.create({
        tenantId: testTenantId,
        importJob: { connect: { id: job.id } },
        supplierId: 'supplier-123',
        supplierName: 'Test Supplier',
        supplierTier: 'TIER_2',
        effectiveDate: new Date(),
        originalCurrency: 'USD',
        baseCurrency: 'CHF',
        source: 'upload',
        importedBy: 'test-user',
        version: 1,
        status: 'DRAFT',
        dataQuality: {
          overallScore: 85,
          completeness: 90,
          accuracy: 85,
          consistency: 80,
          freshness: 0,
          issues: { critical: 0, warnings: 2, info: 5 },
          checks: [],
        },
      });

      expect(rateCard).toBeDefined();
      expect(rateCard.id).toBeDefined();
      expect(rateCard.supplierId).toBe('supplier-123');
    });

    it('should find rate cards by supplier', async () => {
      const rateCards = await rateCardRepo.findBySupplier(
        testTenantId,
        'supplier-123'
      );
      expect(Array.isArray(rateCards)).toBe(true);
    });
  });

  describe('RoleRateRepository', () => {
    it('should create role rates for a rate card', async () => {
      // Create import job and rate card first
      const job = await importJobRepo.create({
        tenantId: testTenantId,
        source: 'UPLOAD',
        status: 'COMPLETED',
        priority: 'NORMAL',
        fileType: 'XLSX',
        extractedData: { rows: [], totalRows: 0 },
        columnMappings: [],
        mappingConfidence: 0,
        rowsProcessed: 0,
        rowsSucceeded: 0,
        rowsFailed: 0,
        errors: [],
        warnings: [],
        requiresReview: false,
      });

      const rateCard = await rateCardRepo.create({
        tenantId: testTenantId,
        importJob: { connect: { id: job.id } },
        supplierId: 'supplier-456',
        supplierName: 'Test Supplier 2',
        supplierTier: 'BIG_4',
        effectiveDate: new Date(),
        originalCurrency: 'USD',
        baseCurrency: 'CHF',
        source: 'upload',
        importedBy: 'test-user',
        version: 1,
        status: 'DRAFT',
        dataQuality: { overallScore: 90, completeness: 95, accuracy: 90, consistency: 85, freshness: 0, issues: { critical: 0, warnings: 0, info: 0 }, checks: [] },
      });

      // Create role rate
      const roleRate = await roleRateRepo.create({
        rateCard: { connect: { id: rateCard.id } },
        originalRoleName: 'Senior Developer',
        standardizedRole: 'Software Engineer',
        roleCategory: 'Engineering',
        seniorityLevel: 'SENIOR',
        serviceLine: 'Technology',
        skills: ['JavaScript', 'TypeScript', 'React'],
        certifications: [],
        originalLocation: 'New York',
        geography: 'North America',
        region: 'Northeast',
        country: 'USA',
        originalRate: 150,
        originalPeriod: 'HOURLY',
        originalCurrency: 'USD',
        hourlyRate: 150,
        dailyRate: 1200,
        monthlyRate: 26000,
        annualRate: 312000,
        baseCurrency: 'USD',
        confidence: 0.95,
        dataQuality: 'HIGH',
        issues: [],
        warnings: [],
      });

      expect(roleRate).toBeDefined();
      expect(roleRate.id).toBeDefined();
      expect(roleRate.standardizedRole).toBe('Software Engineer');
    });

    it('should find unique roles', async () => {
      const roles = await roleRateRepo.findUniqueRoles();
      expect(Array.isArray(roles)).toBe(true);
    });
  });
});
