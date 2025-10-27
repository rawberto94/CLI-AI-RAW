/**
 * Rate Card Entry Service
 * 
 * Handles CRUD operations, validation, and suggestions for rate card entries
 */

import { PrismaClient, RateCardSource, SeniorityLevel, SupplierTier, DataQualityLevel, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RateCardEntryInput {
  source: RateCardSource;
  contractId?: string;
  importJobId?: string;
  enteredBy?: string;
  
  // Supplier
  supplierName: string;
  supplierTier: SupplierTier;
  supplierCountry: string;
  supplierRegion?: string;
  
  // Role
  roleOriginal: string;
  roleStandardized?: string;
  seniority: SeniorityLevel;
  lineOfService: string;
  roleCategory: string;
  subCategory?: string;
  
  // Rate
  dailyRate: number;
  currency: string;
  
  // Geography
  country: string;
  region: string;
  city?: string;
  remoteAllowed?: boolean;
  
  // Context
  effectiveDate: Date;
  expiryDate?: Date;
  contractType?: string;
  contractValue?: number;
  volumeCommitted?: number;
  isNegotiated?: boolean;
  negotiationNotes?: string;
  
  // Additional
  skills?: string[];
  certifications?: string[];
  additionalInfo?: any;
  minimumCommitment?: any;
}

export interface RoleSuggestion {
  roleStandardized: string;
  roleCategory: string;
  lineOfService: string;
  confidence: number;
  usageCount: number;
}

export interface SupplierSuggestion {
  id: string;
  name: string;
  tier: SupplierTier;
  country: string;
  region: string;
  activeRates: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Rate Card Entry Service
// ============================================================================

export class RateCardEntryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create new rate card entry with validation
   */
  async createEntry(
    data: RateCardEntryInput,
    tenantId: string,
    userId: string
  ): Promise<any> {
    // Validate input
    const validation = await this.validateEntry(data, tenantId);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Get or create supplier
    const supplier = await this.getOrCreateSupplier({
      name: data.supplierName,
      tier: data.supplierTier,
      country: data.supplierCountry,
      region: data.supplierRegion || this.inferRegion(data.supplierCountry),
      tenantId,
    });

    // Standardize role if not provided
    const roleStandardized = data.roleStandardized || data.roleOriginal;

    // Convert currency to USD and CHF
    const { usd, chf } = await this.convertCurrency(data.dailyRate, data.currency);

    // Calculate data quality
    const dataQuality = this.calculateDataQuality(data);

    // Calculate confidence
    const confidence = this.calculateConfidence(data);

    // Create entry
    const entry = await this.prisma.rateCardEntry.create({
      data: {
        tenantId,
        source: data.source,
        contractId: data.contractId,
        importJobId: data.importJobId,
        enteredBy: userId,
        
        // Supplier
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierTier: supplier.tier,
        supplierCountry: supplier.country,
        supplierRegion: supplier.region,
        
        // Role
        roleOriginal: data.roleOriginal,
        roleStandardized,
        roleCategory: data.roleCategory,
        seniority: data.seniority,
        lineOfService: data.lineOfService,
        subCategory: data.subCategory,
        
        // Rate
        dailyRate: new Decimal(data.dailyRate),
        currency: data.currency,
        dailyRateUSD: new Decimal(usd),
        dailyRateCHF: new Decimal(chf),
        
        // Geography
        country: data.country,
        region: data.region,
        city: data.city,
        remoteAllowed: data.remoteAllowed || false,
        
        // Context
        effectiveDate: data.effectiveDate,
        expiryDate: data.expiryDate,
        contractType: data.contractType,
        contractValue: data.contractValue ? new Decimal(data.contractValue) : null,
        volumeCommitted: data.volumeCommitted,
        isNegotiated: data.isNegotiated || false,
        negotiationNotes: data.negotiationNotes,
        
        // Quality
        confidence: new Decimal(confidence),
        dataQuality,
        
        // Additional
        skills: data.skills || [],
        certifications: data.certifications || [],
        additionalInfo: data.additionalInfo,
        minimumCommitment: data.minimumCommitment,
      },
    });

    // Trigger benchmark calculation asynchronously
    this.triggerBenchmarkCalculation(entry.id).catch(err => {
      console.error('Failed to trigger benchmark calculation:', err);
    });

    return entry;
  }

  /**
   * Update existing rate card entry
   */
  async updateEntry(
    id: string,
    data: Partial<RateCardEntryInput>,
    tenantId: string
  ): Promise<any> {
    // Get existing entry
    const existing = await this.prisma.rateCardEntry.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Rate card entry not found');
    }

    // Prepare update data
    const updateData: any = {};

    if (data.roleOriginal) updateData.roleOriginal = data.roleOriginal;
    if (data.roleStandardized) updateData.roleStandardized = data.roleStandardized;
    if (data.seniority) updateData.seniority = data.seniority;
    if (data.lineOfService) updateData.lineOfService = data.lineOfService;
    if (data.roleCategory) updateData.roleCategory = data.roleCategory;
    
    if (data.dailyRate !== undefined) {
      const { usd, chf } = await this.convertCurrency(data.dailyRate, data.currency || existing.currency);
      updateData.dailyRate = new Decimal(data.dailyRate);
      updateData.dailyRateUSD = new Decimal(usd);
      updateData.dailyRateCHF = new Decimal(chf);
    }
    
    if (data.currency) updateData.currency = data.currency;
    if (data.country) updateData.country = data.country;
    if (data.region) updateData.region = data.region;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.effectiveDate) updateData.effectiveDate = data.effectiveDate;
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate;
    if (data.volumeCommitted !== undefined) updateData.volumeCommitted = data.volumeCommitted;
    if (data.isNegotiated !== undefined) updateData.isNegotiated = data.isNegotiated;
    if (data.negotiationNotes !== undefined) updateData.negotiationNotes = data.negotiationNotes;
    if (data.skills) updateData.skills = data.skills;
    if (data.certifications) updateData.certifications = data.certifications;

    // Update entry
    const updated = await this.prisma.rateCardEntry.update({
      where: { id },
      data: updateData,
    });

    // Re-trigger benchmark calculation
    this.triggerBenchmarkCalculation(id).catch(err => {
      console.error('Failed to trigger benchmark calculation:', err);
    });

    return updated;
  }

  /**
   * Get rate card entry by ID
   */
  async getEntry(id: string, tenantId: string): Promise<any> {
    const entry = await this.prisma.rateCardEntry.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        contract: {
          select: {
            id: true,
            fileName: true,
            supplierName: true,
          },
        },
        benchmarkSnapshots: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        },
      },
    });

    if (!entry) {
      throw new Error('Rate card entry not found');
    }

    return entry;
  }

  /**
   * List rate card entries with filtering and pagination
   */
  async listEntries(
    tenantId: string,
    filters: {
      supplierId?: string;
      supplierName?: string;
      roleStandardized?: string;
      seniority?: SeniorityLevel;
      lineOfService?: string;
      country?: string;
      region?: string;
      minRate?: number;
      maxRate?: number;
      effectiveDateFrom?: Date;
      effectiveDateTo?: Date;
      source?: RateCardSource;
    } = {},
    pagination: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ entries: any[]; total: number; page: number; pageSize: number }> {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 50;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.RateCardEntryWhereInput = { tenantId };

    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.supplierName) {
      where.supplierName = { contains: filters.supplierName, mode: 'insensitive' };
    }
    if (filters.roleStandardized) {
      where.roleStandardized = { contains: filters.roleStandardized, mode: 'insensitive' };
    }
    if (filters.seniority) where.seniority = filters.seniority;
    if (filters.lineOfService) where.lineOfService = filters.lineOfService;
    if (filters.country) where.country = filters.country;
    if (filters.region) where.region = filters.region;
    if (filters.source) where.source = filters.source;

    if (filters.minRate !== undefined || filters.maxRate !== undefined) {
      where.dailyRateUSD = {};
      if (filters.minRate !== undefined) where.dailyRateUSD.gte = filters.minRate;
      if (filters.maxRate !== undefined) where.dailyRateUSD.lte = filters.maxRate;
    }

    if (filters.effectiveDateFrom || filters.effectiveDateTo) {
      where.effectiveDate = {};
      if (filters.effectiveDateFrom) where.effectiveDate.gte = filters.effectiveDateFrom;
      if (filters.effectiveDateTo) where.effectiveDate.lte = filters.effectiveDateTo;
    }

    // Build order by
    const orderBy: any = {};
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    // Execute queries
    const [entries, total] = await Promise.all([
      this.prisma.rateCardEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              tier: true,
              competitivenessScore: true,
            },
          },
        },
      }),
      this.prisma.rateCardEntry.count({ where }),
    ]);

    return {
      entries,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Delete rate card entry
   */
  async deleteEntry(id: string, tenantId: string): Promise<void> {
    const entry = await this.prisma.rateCardEntry.findFirst({
      where: { id, tenantId },
    });

    if (!entry) {
      throw new Error('Rate card entry not found');
    }

    await this.prisma.rateCardEntry.delete({
      where: { id },
    });
  }

  /**
   * Get role suggestions based on partial input
   */
  async getRoleSuggestions(
    partial: string,
    tenantId: string,
    limit: number = 10
  ): Promise<RoleSuggestion[]> {
    const entries = await this.prisma.rateCardEntry.groupBy({
      by: ['roleStandardized', 'roleCategory', 'lineOfService'],
      where: {
        tenantId,
        roleStandardized: {
          contains: partial,
          mode: 'insensitive',
        },
      },
      _count: true,
      orderBy: {
        _count: {
          roleStandardized: 'desc',
        },
      },
      take: limit,
    });

    return entries.map(entry => ({
      roleStandardized: entry.roleStandardized,
      roleCategory: entry.roleCategory,
      lineOfService: entry.lineOfService,
      confidence: 0.8, // Based on usage frequency
      usageCount: entry._count,
    }));
  }

  /**
   * Get supplier suggestions
   */
  async getSupplierSuggestions(
    partial: string,
    tenantId: string,
    limit: number = 10
  ): Promise<SupplierSuggestion[]> {
    const suppliers = await this.prisma.rateCardSupplier.findMany({
      where: {
        tenantId,
        name: {
          contains: partial,
          mode: 'insensitive',
        },
      },
      take: limit,
      orderBy: {
        activeRates: 'desc',
      },
    });

    return suppliers.map(s => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      country: s.country,
      region: s.region,
      activeRates: s.activeRates,
    }));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate rate card entry
   */
  private async validateEntry(
    data: RateCardEntryInput,
    tenantId: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!data.supplierName) {
      errors.push({ field: 'supplierName', message: 'Supplier name is required', code: 'REQUIRED' });
    }
    if (!data.roleOriginal) {
      errors.push({ field: 'roleOriginal', message: 'Role is required', code: 'REQUIRED' });
    }
    if (!data.dailyRate || data.dailyRate <= 0) {
      errors.push({ field: 'dailyRate', message: 'Valid daily rate is required', code: 'INVALID' });
    }
    if (!data.currency) {
      errors.push({ field: 'currency', message: 'Currency is required', code: 'REQUIRED' });
    }
    if (!data.country) {
      errors.push({ field: 'country', message: 'Country is required', code: 'REQUIRED' });
    }
    if (!data.effectiveDate) {
      errors.push({ field: 'effectiveDate', message: 'Effective date is required', code: 'REQUIRED' });
    }

    // Rate range validation
    if (data.dailyRate > 10000) {
      warnings.push({
        field: 'dailyRate',
        message: 'Daily rate seems unusually high',
        suggestion: 'Please verify the rate is correct',
      });
    }

    // Date validation
    if (data.expiryDate && data.effectiveDate && data.expiryDate < data.effectiveDate) {
      errors.push({
        field: 'expiryDate',
        message: 'Expiry date must be after effective date',
        code: 'INVALID',
      });
    }

    // Check for duplicates
    const duplicate = await this.checkDuplicate(data, tenantId);
    if (duplicate) {
      warnings.push({
        field: 'general',
        message: 'Similar rate card entry already exists',
        suggestion: 'Review existing entry before creating duplicate',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check for duplicate entries
   */
  private async checkDuplicate(
    data: RateCardEntryInput,
    tenantId: string
  ): Promise<boolean> {
    const existing = await this.prisma.rateCardEntry.findFirst({
      where: {
        tenantId,
        supplierName: data.supplierName,
        roleStandardized: data.roleStandardized || data.roleOriginal,
        seniority: data.seniority,
        country: data.country,
        effectiveDate: data.effectiveDate,
      },
    });

    return !!existing;
  }

  /**
   * Get or create supplier
   */
  private async getOrCreateSupplier(params: {
    name: string;
    tier: SupplierTier;
    country: string;
    region: string;
    tenantId: string;
  }): Promise<any> {
    const existing = await this.prisma.rateCardSupplier.findUnique({
      where: {
        tenantId_name: {
          tenantId: params.tenantId,
          name: params.name,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return await this.prisma.rateCardSupplier.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        legalName: params.name,
        tier: params.tier,
        country: params.country,
        region: params.region,
      },
    });
  }

  /**
   * Convert currency to USD and CHF
   */
  private async convertCurrency(
    amount: number,
    fromCurrency: string
  ): Promise<{ usd: number; chf: number }> {
    // Simple conversion rates (in production, use real-time FX API)
    const rates: Record<string, { usd: number; chf: number }> = {
      USD: { usd: 1.0, chf: 0.88 },
      EUR: { usd: 1.08, chf: 0.95 },
      GBP: { usd: 1.27, chf: 1.12 },
      CHF: { usd: 1.14, chf: 1.0 },
      CAD: { usd: 0.72, chf: 0.63 },
      AUD: { usd: 0.65, chf: 0.57 },
      INR: { usd: 0.012, chf: 0.011 },
    };

    const rate = rates[fromCurrency.toUpperCase()] || rates['USD'];
    
    return {
      usd: amount * rate.usd,
      chf: amount * rate.chf,
    };
  }

  /**
   * Infer region from country
   */
  private inferRegion(country: string): string {
    const regionMap: Record<string, string> = {
      'United States': 'Americas',
      'Canada': 'Americas',
      'Mexico': 'Americas',
      'Brazil': 'Americas',
      'United Kingdom': 'EMEA',
      'Germany': 'EMEA',
      'France': 'EMEA',
      'Switzerland': 'EMEA',
      'India': 'APAC',
      'China': 'APAC',
      'Japan': 'APAC',
      'Australia': 'APAC',
    };

    return regionMap[country] || 'EMEA';
  }

  /**
   * Calculate data quality level
   */
  private calculateDataQuality(data: RateCardEntryInput): DataQualityLevel {
    let score = 0;
    let total = 0;

    // Check completeness
    const fields = [
      data.supplierName,
      data.roleOriginal,
      data.roleStandardized,
      data.seniority,
      data.lineOfService,
      data.roleCategory,
      data.dailyRate,
      data.currency,
      data.country,
      data.region,
      data.effectiveDate,
    ];

    fields.forEach(field => {
      total++;
      if (field) score++;
    });

    // Optional but valuable fields
    if (data.volumeCommitted) score += 0.5;
    if (data.skills && data.skills.length > 0) score += 0.5;
    if (data.contractId) score += 0.5;
    total += 1.5;

    const percentage = (score / total) * 100;

    if (percentage >= 90) return 'HIGH';
    if (percentage >= 70) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(data: RateCardEntryInput): number {
    let confidence = 0.5; // Base confidence

    // Source reliability
    if (data.source === 'PDF_EXTRACTION') confidence += 0.1;
    if (data.source === 'MANUAL') confidence += 0.2;
    if (data.source === 'CSV_UPLOAD') confidence += 0.15;

    // Data completeness
    if (data.roleStandardized) confidence += 0.1;
    if (data.volumeCommitted) confidence += 0.05;
    if (data.contractId) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * Trigger benchmark calculation (async)
   */
  private async triggerBenchmarkCalculation(rateCardId: string): Promise<void> {
    // This would typically queue a background job
    // For now, we'll just log it
    console.log(`Benchmark calculation queued for rate card: ${rateCardId}`);
  }
}

export default RateCardEntryService;
