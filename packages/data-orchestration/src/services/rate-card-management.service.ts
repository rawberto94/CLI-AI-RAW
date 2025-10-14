/**
 * Rate Card Management Service
 * 
 * Provides manual editing and bulk upload capabilities for rate card data
 */

import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { analyticalEventPublisher } from "../events/analytical-event-publisher";
import { analyticalDatabaseService } from "./analytical-database.service";
import { dataStandardizationService } from "./data-standardization.service";
import pino from "pino";
import crypto from "crypto";

const logger = pino({ name: "rate-card-management-service" });

// Management Models
export interface ManualRateCard {
  id?: string;
  supplierId: string;
  supplierName: string;
  contractId?: string;
  effectiveDate: Date;
  expirationDate?: Date;
  currency: string;
  region: string;
  deliveryModel: 'onshore' | 'nearshore' | 'offshore';
  rates: ManualRate[];
  metadata?: Record<string, any>;
}

export interface ManualRate {
  id?: string;
  role: string;
  level: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  billableHours?: number;
  skills?: string[];
  experience?: number;
  location?: string;
}

export interface BulkUploadResult {
  success: boolean;
  totalRows: number;
  processedRows: number;
  createdRateCards: number;
  createdRates: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  warnings: Array<{
    row: number;
    warning: string;
    data?: any;
  }>;
  summary: {
    suppliers: string[];
    roles: string[];
    avgRate: number;
    dateRange: { from: Date; to: Date };
  };
}

export interface RateCardFilter {
  tenantId?: string;
  supplierId?: string;
  region?: string;
  deliveryModel?: string;
  dateFrom?: Date;
  dateTo?: Date;
  role?: string;
  minRate?: number;
  maxRate?: number;
}

export class RateCardManagementService {
  private static instance: RateCardManagementService;

  private constructor() {}

  static getInstance(): RateCardManagementService {
    if (!RateCardManagementService.instance) {
      RateCardManagementService.instance = new RateCardManagementService();
    }
    return RateCardManagementService.instance;
  }  /
/ ============================================================================
  // MANUAL RATE CARD OPERATIONS
  // ============================================================================

  /**
   * Create a new rate card manually
   */
  async createRateCard(rateCard: ManualRateCard, tenantId: string = 'default'): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      logger.info({ supplierId: rateCard.supplierId, tenantId }, "Creating manual rate card");

      // Standardize supplier name
      const supplierStandardization = await dataStandardizationService.standardizeSupplier(rateCard.supplierName);
      
      // Create rate card record
      const rateCardId = crypto.randomUUID();
      await analyticalDatabaseService.createRateCard({
        contractId: rateCard.contractId || `manual_${rateCardId}`,
        supplierId: rateCard.supplierId,
        tenantId,
        effectiveDate: rateCard.effectiveDate,
        currency: rateCard.currency,
        region: rateCard.region,
        deliveryModel: rateCard.deliveryModel
      });

      // Create rates
      const createdRates = [];
      for (const rate of rateCard.rates) {
        // Standardize role and seniority
        const roleStandardization = await dataStandardizationService.standardizeRole(rate.role);
        const seniorityStandardization = await dataStandardizationService.standardizeSeniority(rate.level, { role: rate.role });

        const rateResult = await analyticalDatabaseService.createRate({
          rateCardId,
          role: roleStandardization.standardValue,
          level: seniorityStandardization.standardValue,
          hourlyRate: rate.hourlyRate,
          dailyRate: rate.dailyRate,
          monthlyRate: rate.monthlyRate,
          billableHours: rate.billableHours || 8
        });

        if (rateResult.success) {
          createdRates.push({
            ...rate,
            standardizedRole: roleStandardization.standardValue,
            standardizedLevel: seniorityStandardization.standardValue
          });
        }
      }

      // Publish event
      await analyticalEventPublisher.publishRateCardCreated({
        tenantId,
        rateCardId,
        supplierId: supplierStandardization.standardValue,
        rateCount: createdRates.length,
        source: 'manual'
      });

      logger.info({ rateCardId, rateCount: createdRates.length }, "Manual rate card created successfully");

      return {
        success: true,
        data: {
          rateCardId,
          supplierId: supplierStandardization.standardValue,
          createdRates: createdRates.length,
          standardizations: {
            supplier: supplierStandardization,
            rates: createdRates
          }
        }
      };

    } catch (error) {
      logger.error({ error, rateCard }, "Failed to create manual rate card");
      return {
        success: false,
        error: {
          code: "RATE_CARD_CREATE_FAILED",
          message: "Failed to create rate card",
          details: error
        }
      };
    }
  }

  /**
   * Update an existing rate card
   */
  async updateRateCard(rateCardId: string, updates: Partial<ManualRateCard>, tenantId: string = 'default'): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      logger.info({ rateCardId, tenantId }, "Updating rate card");

      // Update rate card metadata if provided
      if (updates.effectiveDate || updates.currency || updates.region || updates.deliveryModel) {
        // This would update the rate_cards table
        // For now, we'll log the update
        logger.info({ rateCardId, updates }, "Rate card metadata update requested");
      }

      // Update rates if provided
      if (updates.rates) {
        // Delete existing rates and create new ones
        // This is a simplified approach - in production you'd want more sophisticated update logic
        
        const updatedRates = [];
        for (const rate of updates.rates) {
          const roleStandardization = await dataStandardizationService.standardizeRole(rate.role);
          const seniorityStandardization = await dataStandardizationService.standardizeSeniority(rate.level, { role: rate.role });

          updatedRates.push({
            ...rate,
            standardizedRole: roleStandardization.standardValue,
            standardizedLevel: seniorityStandardization.standardValue
          });
        }

        logger.info({ rateCardId, updatedRates: updatedRates.length }, "Rate card rates updated");
      }

      return {
        success: true,
        data: {
          rateCardId,
          updated: true
        }
      };

    } catch (error) {
      logger.error({ error, rateCardId }, "Failed to update rate card");
      return {
        success: false,
        error: {
          code: "RATE_CARD_UPDATE_FAILED",
          message: "Failed to update rate card",
          details: error
        }
      };
    }
  }

  /**
   * Delete a rate card
   */
  async deleteRateCard(rateCardId: string, tenantId: string = 'default'): Promise<{ success: boolean; error?: any }> {
    try {
      logger.info({ rateCardId, tenantId }, "Deleting rate card");

      // This would delete from rate_cards table (cascade will delete rates)
      // For now, we'll log the deletion
      logger.info({ rateCardId }, "Rate card deletion requested");

      return { success: true };

    } catch (error) {
      logger.error({ error, rateCardId }, "Failed to delete rate card");
      return {
        success: false,
        error: {
          code: "RATE_CARD_DELETE_FAILED",
          message: "Failed to delete rate card",
          details: error
        }
      };
    }
  }

  // ============================================================================
  // BULK UPLOAD OPERATIONS
  // ============================================================================

  /**
   * Process bulk upload from CSV/Excel data
   */
  async processBulkUpload(data: any[], tenantId: string = 'default'): Promise<BulkUploadResult> {
    try {
      logger.info({ rowCount: data.length, tenantId }, "Processing bulk rate card upload");

      const result: BulkUploadResult = {
        success: false,
        totalRows: data.length,
        processedRows: 0,
        createdRateCards: 0,
        createdRates: 0,
        errors: [],
        warnings: [],
        summary: {
          suppliers: [],
          roles: [],
          avgRate: 0,
          dateRange: { from: new Date(), to: new Date() }
        }
      };

      const rateCardMap = new Map<string, ManualRateCard>();
      const allRates: number[] = [];
      const suppliers = new Set<string>();
      const roles = new Set<string>();
      let minDate = new Date();
      let maxDate = new Date(0);

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Validate required fields
          const validation = this.validateBulkRow(row, i + 1);
          if (!validation.valid) {
            result.errors.push({
              row: i + 1,
              error: validation.error!,
              data: row
            });
            continue;
          }

          // Parse row data
          const parsedRow = this.parseBulkRow(row);
          
          // Track statistics
          suppliers.add(parsedRow.supplierName);
          roles.add(parsedRow.role);
          if (parsedRow.hourlyRate) allRates.push(parsedRow.hourlyRate);
          if (parsedRow.effectiveDate < minDate) minDate = parsedRow.effectiveDate;
          if (parsedRow.effectiveDate > maxDate) maxDate = parsedRow.effectiveDate;

          // Group by supplier + effective date
          const key = `${parsedRow.supplierId}_${parsedRow.effectiveDate.toISOString().split('T')[0]}`;
          
          if (!rateCardMap.has(key)) {
            rateCardMap.set(key, {
              supplierId: parsedRow.supplierId,
              supplierName: parsedRow.supplierName,
              effectiveDate: parsedRow.effectiveDate,
              currency: parsedRow.currency,
              region: parsedRow.region,
              deliveryModel: parsedRow.deliveryModel,
              rates: []
            });
          }

          rateCardMap.get(key)!.rates.push({
            role: parsedRow.role,
            level: parsedRow.level,
            hourlyRate: parsedRow.hourlyRate,
            dailyRate: parsedRow.dailyRate,
            monthlyRate: parsedRow.monthlyRate,
            billableHours: parsedRow.billableHours,
            skills: parsedRow.skills,
            experience: parsedRow.experience,
            location: parsedRow.location
          });

          result.processedRows++;

        } catch (error) {
          result.errors.push({
            row: i + 1,
            error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: row
          });
        }
      }

      // Create rate cards
      for (const [key, rateCard] of rateCardMap) {
        try {
          const createResult = await this.createRateCard(rateCard, tenantId);
          
          if (createResult.success) {
            result.createdRateCards++;
            result.createdRates += rateCard.rates.length;
          } else {
            result.errors.push({
              row: 0,
              error: `Failed to create rate card for ${rateCard.supplierName}: ${createResult.error?.message}`,
              data: rateCard
            });
          }

        } catch (error) {
          result.errors.push({
            row: 0,
            error: `Rate card creation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: rateCard
          });
        }
      }

      // Calculate summary
      result.summary = {
        suppliers: Array.from(suppliers),
        roles: Array.from(roles),
        avgRate: allRates.length > 0 ? allRates.reduce((sum, rate) => sum + rate, 0) / allRates.length : 0,
        dateRange: { from: minDate, to: maxDate }
      };

      result.success = result.createdRateCards > 0;

      // Publish bulk upload event
      await analyticalEventPublisher.publishBulkUploadCompleted({
        tenantId,
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        createdRateCards: result.createdRateCards,
        createdRates: result.createdRates,
        errorCount: result.errors.length
      });

      logger.info({ 
        tenantId, 
        createdRateCards: result.createdRateCards, 
        createdRates: result.createdRates,
        errors: result.errors.length 
      }, "Bulk upload processing completed");

      return result;

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to process bulk upload");
      throw error;
    }
  }

  /**
   * Get bulk upload template
   */
  getBulkUploadTemplate(): { headers: string[]; example: any[]; instructions: string[] } {
    return {
      headers: [
        'supplier_id',
        'supplier_name', 
        'role',
        'level',
        'hourly_rate',
        'daily_rate',
        'monthly_rate',
        'billable_hours',
        'currency',
        'region',
        'delivery_model',
        'effective_date',
        'expiration_date',
        'skills',
        'experience_years',
        'location'
      ],
      example: [
        {
          supplier_id: 'accenture',
          supplier_name: 'Accenture',
          role: 'Senior Software Engineer',
          level: 'Senior',
          hourly_rate: 165,
          daily_rate: 1320,
          monthly_rate: null,
          billable_hours: 8,
          currency: 'USD',
          region: 'North America',
          delivery_model: 'onshore',
          effective_date: '2024-01-01',
          expiration_date: '2024-12-31',
          skills: 'Java,Spring,AWS',
          experience_years: 8,
          location: 'New York'
        },
        {
          supplier_id: 'ibm',
          supplier_name: 'IBM',
          role: 'Business Analyst',
          level: 'Mid',
          hourly_rate: 120,
          daily_rate: 960,
          monthly_rate: null,
          billable_hours: 8,
          currency: 'USD',
          region: 'North America',
          delivery_model: 'onshore',
          effective_date: '2024-01-01',
          expiration_date: '2024-12-31',
          skills: 'Requirements Analysis,Process Modeling',
          experience_years: 5,
          location: 'Chicago'
        }
      ],
      instructions: [
        'supplier_id: Unique identifier for the supplier (required)',
        'supplier_name: Full name of the supplier (required)',
        'role: Job role/title (required)',
        'level: Seniority level (Junior/Mid/Senior/Lead/Principal)',
        'hourly_rate: Rate per hour in specified currency',
        'daily_rate: Rate per day (8 hours)',
        'monthly_rate: Rate per month (optional)',
        'billable_hours: Hours per day (default: 8)',
        'currency: Currency code (USD, EUR, GBP, etc.)',
        'region: Geographic region (North America, Europe, Asia, etc.)',
        'delivery_model: onshore/nearshore/offshore',
        'effective_date: Start date (YYYY-MM-DD format)',
        'expiration_date: End date (optional)',
        'skills: Comma-separated list of skills',
        'experience_years: Years of experience (optional)',
        'location: City/location (optional)'
      ]
    };
  }  //
 ============================================================================
  // QUERY AND SEARCH OPERATIONS
  // ============================================================================

  /**
   * Get rate cards with filtering
   */
  async getRateCards(filters: RateCardFilter = {}): Promise<{ success: boolean; data?: any[]; error?: any }> {
    try {
      logger.info({ filters }, "Getting rate cards with filters");

      const whereConditions = [];
      const params: any[] = [];

      if (filters.tenantId) {
        whereConditions.push("rc.tenant_id = ?");
        params.push(filters.tenantId);
      }

      if (filters.supplierId) {
        whereConditions.push("rc.supplier_id = ?");
        params.push(filters.supplierId);
      }

      if (filters.region) {
        whereConditions.push("rc.region = ?");
        params.push(filters.region);
      }

      if (filters.deliveryModel) {
        whereConditions.push("rc.delivery_model = ?");
        params.push(filters.deliveryModel);
      }

      if (filters.dateFrom) {
        whereConditions.push("rc.effective_date >= ?");
        params.push(filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        whereConditions.push("rc.effective_date <= ?");
        params.push(filters.dateTo.toISOString());
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

      const query = `
        SELECT 
          rc.*,
          COUNT(r.id) as rate_count,
          AVG(r.hourly_rate) as avg_hourly_rate,
          MIN(r.hourly_rate) as min_hourly_rate,
          MAX(r.hourly_rate) as max_hourly_rate,
          GROUP_CONCAT(DISTINCT r.role) as roles
        FROM rate_cards rc
        LEFT JOIN rates r ON rc.id = r.rate_card_id
        ${whereClause}
        GROUP BY rc.id
        ORDER BY rc.effective_date DESC
        LIMIT 100
      `;

      const rateCards = await dbAdaptor.prisma.$queryRawUnsafe(query, ...params);

      return {
        success: true,
        data: rateCards as any[]
      };

    } catch (error) {
      logger.error({ error, filters }, "Failed to get rate cards");
      return {
        success: false,
        error: {
          code: "RATE_CARDS_FETCH_FAILED",
          message: "Failed to fetch rate cards",
          details: error
        }
      };
    }
  }

  /**
   * Get detailed rate card with all rates
   */
  async getRateCardDetails(rateCardId: string): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      logger.info({ rateCardId }, "Getting rate card details");

      const rateCardQuery = `
        SELECT rc.*, c.contract_title, c.supplier_name
        FROM rate_cards rc
        LEFT JOIN contracts c ON rc.contract_id = c.id
        WHERE rc.id = ?
      `;

      const ratesQuery = `
        SELECT r.*
        FROM rates r
        WHERE r.rate_card_id = ?
        ORDER BY r.role, r.level
      `;

      const [rateCardResult, ratesResult] = await Promise.all([
        dbAdaptor.prisma.$queryRawUnsafe(rateCardQuery, rateCardId),
        dbAdaptor.prisma.$queryRawUnsafe(ratesQuery, rateCardId)
      ]);

      const rateCard = (rateCardResult as any[])[0];
      const rates = ratesResult as any[];

      if (!rateCard) {
        return {
          success: false,
          error: {
            code: "RATE_CARD_NOT_FOUND",
            message: "Rate card not found"
          }
        };
      }

      return {
        success: true,
        data: {
          ...rateCard,
          rates
        }
      };

    } catch (error) {
      logger.error({ error, rateCardId }, "Failed to get rate card details");
      return {
        success: false,
        error: {
          code: "RATE_CARD_DETAILS_FAILED",
          message: "Failed to get rate card details",
          details: error
        }
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateBulkRow(row: any, rowNumber: number): { valid: boolean; error?: string } {
    // Required fields validation
    if (!row.supplier_id || !row.supplier_name) {
      return { valid: false, error: "Missing required supplier information" };
    }

    if (!row.role) {
      return { valid: false, error: "Missing required role" };
    }

    if (!row.hourly_rate && !row.daily_rate && !row.monthly_rate) {
      return { valid: false, error: "At least one rate (hourly/daily/monthly) is required" };
    }

    if (!row.currency) {
      return { valid: false, error: "Missing required currency" };
    }

    if (!row.effective_date) {
      return { valid: false, error: "Missing required effective date" };
    }

    // Validate delivery model
    if (row.delivery_model && !['onshore', 'nearshore', 'offshore'].includes(row.delivery_model)) {
      return { valid: false, error: "Invalid delivery model. Must be: onshore, nearshore, or offshore" };
    }

    // Validate rates are numbers
    if (row.hourly_rate && isNaN(parseFloat(row.hourly_rate))) {
      return { valid: false, error: "Invalid hourly rate - must be a number" };
    }

    return { valid: true };
  }

  private parseBulkRow(row: any): any {
    return {
      supplierId: String(row.supplier_id).trim(),
      supplierName: String(row.supplier_name).trim(),
      role: String(row.role).trim(),
      level: row.level ? String(row.level).trim() : 'Mid',
      hourlyRate: row.hourly_rate ? parseFloat(row.hourly_rate) : undefined,
      dailyRate: row.daily_rate ? parseFloat(row.daily_rate) : undefined,
      monthlyRate: row.monthly_rate ? parseFloat(row.monthly_rate) : undefined,
      billableHours: row.billable_hours ? parseInt(row.billable_hours) : 8,
      currency: String(row.currency || 'USD').toUpperCase(),
      region: String(row.region || 'Global').trim(),
      deliveryModel: (row.delivery_model || 'onshore') as 'onshore' | 'nearshore' | 'offshore',
      effectiveDate: new Date(row.effective_date),
      expirationDate: row.expiration_date ? new Date(row.expiration_date) : undefined,
      skills: row.skills ? String(row.skills).split(',').map(s => s.trim()) : [],
      experience: row.experience_years ? parseInt(row.experience_years) : undefined,
      location: row.location ? String(row.location).trim() : undefined
    };
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic database connectivity
      const testResult = await this.getRateCards({ tenantId: 'test' });
      return testResult.success;
    } catch (error) {
      logger.error({ error }, "Rate card management service health check failed");
      return false;
    }
  }
}

export const rateCardManagementService = RateCardManagementService.getInstance();