/**
 * Artifact Database Adaptor
 * 
 * Handles database operations for artifacts, cost savings, and validation
 */

import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'artifact-database-adaptor' });

export interface ArtifactRecord {
  id: string;
  contractId: string;
  tenantId: string;
  type: string;
  data: any;
  confidence?: number;
  completeness?: number;
  validationResult?: any;
  method?: string;
  processingTime?: number;
  version: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostSavingsOpportunityRecord {
  id: string;
  contractId: string;
  tenantId: string;
  category: string;
  title: string;
  description?: string;
  potentialSavingsAmount: number;
  potentialSavingsCurrency: string;
  potentialSavingsPercentage?: number;
  potentialSavingsTimeframe?: string;
  confidence?: string;
  effort?: string;
  priority?: number;
  actionItems?: any;
  implementationTimeline?: string;
  risks?: any;
  status: string;
  trackedAt?: Date;
  implementedAt?: Date;
  realizedSavings?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationIssueRecord {
  id: string;
  artifactId: string;
  field: string;
  rule: string;
  severity: string;
  message: string;
  autoFixable: boolean;
  fixed: boolean;
  fixedAt?: Date;
  createdAt: Date;
}

export class ArtifactDatabaseAdaptor {
  private static instance: ArtifactDatabaseAdaptor;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): ArtifactDatabaseAdaptor {
    if (!ArtifactDatabaseAdaptor.instance) {
      ArtifactDatabaseAdaptor.instance = new ArtifactDatabaseAdaptor();
    }
    return ArtifactDatabaseAdaptor.instance;
  }

  // =========================================================================
  // ARTIFACT OPERATIONS
  // =========================================================================

  async saveArtifact(artifact: Omit<ArtifactRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ArtifactRecord> {
    try {
      const result = await this.prisma.$executeRaw`
        INSERT INTO artifacts (
          contract_id, tenant_id, type, data, confidence, completeness,
          validation_result, method, processing_time, version, created_by
        ) VALUES (
          ${artifact.contractId}::uuid,
          ${artifact.tenantId}::uuid,
          ${artifact.type},
          ${JSON.stringify(artifact.data)}::jsonb,
          ${artifact.confidence},
          ${artifact.completeness},
          ${artifact.validationResult ? JSON.stringify(artifact.validationResult) : null}::jsonb,
          ${artifact.method},
          ${artifact.processingTime},
          ${artifact.version},
          ${artifact.createdBy}::uuid
        )
        RETURNING *
      `;

      logger.info({ contractId: artifact.contractId, type: artifact.type }, 'Artifact saved');
      return result as any;
    } catch (error) {
      logger.error({ error, artifact }, 'Failed to save artifact');
      throw error;
    }
  }

  async getArtifactsByContract(contractId: string): Promise<ArtifactRecord[]> {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT * FROM artifacts
        WHERE contract_id = ${contractId}::uuid
        AND version = (
          SELECT MAX(version) FROM artifacts a2
          WHERE a2.contract_id = artifacts.contract_id
          AND a2.type = artifacts.type
        )
        ORDER BY type
      `;

      return results as ArtifactRecord[];
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to get artifacts');
      throw error;
    }
  }

  async getArtifact(contractId: string, type: string): Promise<ArtifactRecord | null> {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT * FROM artifacts
        WHERE contract_id = ${contractId}::uuid
        AND type = ${type}
        ORDER BY version DESC
        LIMIT 1
      `;

      return (results as ArtifactRecord[])[0] || null;
    } catch (error) {
      logger.error({ error, contractId, type }, 'Failed to get artifact');
      throw error;
    }
  }

  // =========================================================================
  // COST SAVINGS OPERATIONS
  // =========================================================================

  async saveCostSavingsOpportunity(
    opportunity: Omit<CostSavingsOpportunityRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CostSavingsOpportunityRecord> {
    try {
      const result = await this.prisma.$executeRaw`
        INSERT INTO cost_savings_opportunities (
          contract_id, tenant_id, category, title, description,
          potential_savings_amount, potential_savings_currency,
          potential_savings_percentage, potential_savings_timeframe,
          confidence, effort, priority, action_items,
          implementation_timeline, risks, status
        ) VALUES (
          ${opportunity.contractId}::uuid,
          ${opportunity.tenantId}::uuid,
          ${opportunity.category},
          ${opportunity.title},
          ${opportunity.description},
          ${opportunity.potentialSavingsAmount},
          ${opportunity.potentialSavingsCurrency},
          ${opportunity.potentialSavingsPercentage},
          ${opportunity.potentialSavingsTimeframe},
          ${opportunity.confidence},
          ${opportunity.effort},
          ${opportunity.priority},
          ${opportunity.actionItems ? JSON.stringify(opportunity.actionItems) : null}::jsonb,
          ${opportunity.implementationTimeline},
          ${opportunity.risks ? JSON.stringify(opportunity.risks) : null}::jsonb,
          ${opportunity.status}
        )
        RETURNING *
      `;

      logger.info({ contractId: opportunity.contractId, title: opportunity.title }, 'Cost savings opportunity saved');
      return result as any;
    } catch (error) {
      logger.error({ error, opportunity }, 'Failed to save cost savings opportunity');
      throw error;
    }
  }

  async getCostSavingsByContract(contractId: string): Promise<CostSavingsOpportunityRecord[]> {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT * FROM cost_savings_opportunities
        WHERE contract_id = ${contractId}::uuid
        ORDER BY priority DESC, potential_savings_amount DESC
      `;

      return results as CostSavingsOpportunityRecord[];
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to get cost savings');
      throw error;
    }
  }

  async updateOpportunityStatus(
    opportunityId: string,
    status: string,
    notes?: string,
    realizedSavings?: number
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE cost_savings_opportunities
        SET status = ${status},
            notes = ${notes},
            realized_savings = ${realizedSavings},
            tracked_at = NOW(),
            implemented_at = CASE WHEN ${status} = 'implemented' THEN NOW() ELSE implemented_at END
        WHERE id = ${opportunityId}::uuid
      `;

      logger.info({ opportunityId, status }, 'Opportunity status updated');
    } catch (error) {
      logger.error({ error, opportunityId }, 'Failed to update opportunity status');
      throw error;
    }
  }

  // =========================================================================
  // VALIDATION OPERATIONS
  // =========================================================================

  async saveValidationIssues(
    artifactId: string,
    issues: Array<{
      field: string;
      rule: string;
      severity: string;
      message: string;
      autoFixable: boolean;
    }>
  ): Promise<void> {
    try {
      for (const issue of issues) {
        await this.prisma.$executeRaw`
          INSERT INTO validation_issues (
            artifact_id, field, rule, severity, message, auto_fixable
          ) VALUES (
            ${artifactId}::uuid,
            ${issue.field},
            ${issue.rule},
            ${issue.severity},
            ${issue.message},
            ${issue.autoFixable}
          )
        `;
      }

      logger.info({ artifactId, issueCount: issues.length }, 'Validation issues saved');
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to save validation issues');
      throw error;
    }
  }

  async getValidationIssues(artifactId: string): Promise<ValidationIssueRecord[]> {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT * FROM validation_issues
        WHERE artifact_id = ${artifactId}::uuid
        ORDER BY severity, field
      `;

      return results as ValidationIssueRecord[];
    } catch (error) {
      logger.error({ error, artifactId }, 'Failed to get validation issues');
      throw error;
    }
  }

  // =========================================================================
  // METRICS OPERATIONS
  // =========================================================================

  async saveGenerationMetrics(metrics: {
    contractId: string;
    tenantId: string;
    artifactType: string;
    method?: string;
    processingTime?: number;
    confidence?: number;
    completeness?: number;
    success: boolean;
    errorMessage?: string;
    retryCount?: number;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO artifact_generation_metrics (
          contract_id, tenant_id, artifact_type, method,
          processing_time, confidence, completeness,
          success, error_message, retry_count
        ) VALUES (
          ${metrics.contractId}::uuid,
          ${metrics.tenantId}::uuid,
          ${metrics.artifactType},
          ${metrics.method},
          ${metrics.processingTime},
          ${metrics.confidence},
          ${metrics.completeness},
          ${metrics.success},
          ${metrics.errorMessage},
          ${metrics.retryCount || 0}
        )
      `;

      logger.debug({ contractId: metrics.contractId, type: metrics.artifactType }, 'Metrics saved');
    } catch (error) {
      logger.error({ error, metrics }, 'Failed to save metrics');
      // Don't throw - metrics are non-critical
    }
  }

  // =========================================================================
  // ANALYTICS OPERATIONS
  // =========================================================================

  async getAggregatedCostSavings(tenantId: string): Promise<{
    totalContracts: number;
    totalOpportunities: number;
    totalPotentialSavings: number;
    totalRealizedSavings: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT contract_id) as total_contracts,
          COUNT(*) as total_opportunities,
          SUM(potential_savings_amount) as total_potential_savings,
          SUM(CASE WHEN status = 'implemented' THEN realized_savings ELSE 0 END) as total_realized_savings,
          jsonb_object_agg(category, category_total) as by_category,
          jsonb_object_agg(status, status_count) as by_status
        FROM (
          SELECT
            contract_id,
            category,
            status,
            potential_savings_amount,
            realized_savings,
            SUM(potential_savings_amount) OVER (PARTITION BY category) as category_total,
            COUNT(*) OVER (PARTITION BY status) as status_count
          FROM cost_savings_opportunities
          WHERE tenant_id = ${tenantId}::uuid
        ) subquery
      `;

      return (results as any[])[0] || {
        totalContracts: 0,
        totalOpportunities: 0,
        totalPotentialSavings: 0,
        totalRealizedSavings: 0,
        byCategory: {},
        byStatus: {}
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get aggregated cost savings');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export const artifactDatabaseAdaptor = ArtifactDatabaseAdaptor.getInstance();
