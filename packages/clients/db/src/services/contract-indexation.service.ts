import { PrismaClient, Prisma } from '@prisma/client';

export interface ContractMetadata {
  id?: string;
  contractId: string;
  title?: string;
  contractType?: string;
  category?: string;
  subcategory?: string;
  clientName?: string;
  clientType?: string;
  vendorName?: string;
  vendorType?: string;
  totalValue?: number;
  currency?: string;
  paymentTerms?: string;
  billingFrequency?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
  renewalDate?: Date;
  noticePeriodDays?: number;
  autoRenewal?: boolean;
  governingLaw?: string;
  jurisdiction?: string;
  liabilityCap?: number;
  hasIndemnification?: boolean;
  hasConfidentiality?: boolean;
  hasIpClause?: boolean;
  riskScore?: number;
  complianceScore?: number;
  status?: string;
  approvalStatus?: string;
  workflowStage?: string;
  pageCount?: number;
  wordCount?: number;
  language?: string;
  documentFormat?: string;
  templateMatchScore?: number;
  complexityScore?: number;
  readabilityScore?: number;
  lastReviewedAt?: Date;
}

export interface ContractTag {
  contractId: string;
  tagName: string;
  tagCategory?: string;
  confidenceScore?: number;
  createdBy?: string;
}

export interface ContractClause {
  contractId: string;
  clauseType: string;
  clauseTitle?: string;
  clauseText: string;
  pageNumber?: number;
  sectionNumber?: string;
  riskLevel?: string;
  complianceStatus?: string;
  aiSummary?: string;
}

export interface ContractMilestone {
  contractId: string;
  milestoneType: string;
  milestoneName: string;
  dueDate: Date;
  completedDate?: Date;
  status?: string;
  description?: string;
  reminderDays?: number;
}

export interface SearchQuery {
  query?: string;
  filters?: {
    contractType?: string[];
    status?: string[];
    riskScoreRange?: [number, number];
    valueRange?: [number, number];
    expirationDateRange?: [Date, Date];
    tags?: string[];
    clientName?: string;
    vendorName?: string;
  };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  contracts: any[];
  total: number;
  aggregations?: {
    contractTypes: { [key: string]: number };
    riskDistribution: { [key: string]: number };
    statusDistribution: { [key: string]: number };
  };
}

export class ContractIndexationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Index contract metadata for enhanced search and analytics
   */
  async indexContractMetadata(metadata: ContractMetadata): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO contract_metadata (
          contract_id, title, contract_type, category, subcategory,
          client_name, client_type, vendor_name, vendor_type,
          total_value, currency, payment_terms, billing_frequency,
          effective_date, expiration_date, renewal_date, notice_period_days, auto_renewal,
          governing_law, jurisdiction, liability_cap,
          has_indemnification, has_confidentiality, has_ip_clause,
          risk_score, compliance_score, status, approval_status, workflow_stage,
          page_count, word_count, language, document_format,
          template_match_score, complexity_score, readability_score,
          last_reviewed_at
        ) VALUES (
          ${metadata.contractId}, ${metadata.title}, ${metadata.contractType}, 
          ${metadata.category}, ${metadata.subcategory},
          ${metadata.clientName}, ${metadata.clientType}, 
          ${metadata.vendorName}, ${metadata.vendorType},
          ${metadata.totalValue}, ${metadata.currency}, 
          ${metadata.paymentTerms}, ${metadata.billingFrequency},
          ${metadata.effectiveDate}, ${metadata.expirationDate}, 
          ${metadata.renewalDate}, ${metadata.noticePeriodDays}, ${metadata.autoRenewal},
          ${metadata.governingLaw}, ${metadata.jurisdiction}, ${metadata.liabilityCap},
          ${metadata.hasIndemnification}, ${metadata.hasConfidentiality}, ${metadata.hasIpClause},
          ${metadata.riskScore}, ${metadata.complianceScore}, 
          ${metadata.status}, ${metadata.approvalStatus}, ${metadata.workflowStage},
          ${metadata.pageCount}, ${metadata.wordCount}, 
          ${metadata.language}, ${metadata.documentFormat},
          ${metadata.templateMatchScore}, ${metadata.complexityScore}, ${metadata.readabilityScore},
          ${metadata.lastReviewedAt}
        )
        ON CONFLICT (contract_id) DO UPDATE SET
          title = EXCLUDED.title,
          contract_type = EXCLUDED.contract_type,
          category = EXCLUDED.category,
          subcategory = EXCLUDED.subcategory,
          client_name = EXCLUDED.client_name,
          client_type = EXCLUDED.client_type,
          vendor_name = EXCLUDED.vendor_name,
          vendor_type = EXCLUDED.vendor_type,
          total_value = EXCLUDED.total_value,
          currency = EXCLUDED.currency,
          payment_terms = EXCLUDED.payment_terms,
          billing_frequency = EXCLUDED.billing_frequency,
          effective_date = EXCLUDED.effective_date,
          expiration_date = EXCLUDED.expiration_date,
          renewal_date = EXCLUDED.renewal_date,
          notice_period_days = EXCLUDED.notice_period_days,
          auto_renewal = EXCLUDED.auto_renewal,
          governing_law = EXCLUDED.governing_law,
          jurisdiction = EXCLUDED.jurisdiction,
          liability_cap = EXCLUDED.liability_cap,
          has_indemnification = EXCLUDED.has_indemnification,
          has_confidentiality = EXCLUDED.has_confidentiality,
          has_ip_clause = EXCLUDED.has_ip_clause,
          risk_score = EXCLUDED.risk_score,
          compliance_score = EXCLUDED.compliance_score,
          status = EXCLUDED.status,
          approval_status = EXCLUDED.approval_status,
          workflow_stage = EXCLUDED.workflow_stage,
          page_count = EXCLUDED.page_count,
          word_count = EXCLUDED.word_count,
          language = EXCLUDED.language,
          document_format = EXCLUDED.document_format,
          template_match_score = EXCLUDED.template_match_score,
          complexity_score = EXCLUDED.complexity_score,
          readability_score = EXCLUDED.readability_score,
          last_reviewed_at = EXCLUDED.last_reviewed_at,
          updated_at = NOW()
      `;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add tags to a contract for better categorization
   */
  async addContractTags(contractId: string, tags: ContractTag[]): Promise<void> {
    try {
      for (const tag of tags) {
        await this.prisma.$executeRaw`
          INSERT INTO contract_tags (contract_id, tag_name, tag_category, confidence_score, created_by)
          VALUES (${contractId}, ${tag.tagName}, ${tag.tagCategory}, ${tag.confidenceScore}, ${tag.createdBy})
          ON CONFLICT (contract_id, tag_name) DO UPDATE SET
            tag_category = EXCLUDED.tag_category,
            confidence_score = EXCLUDED.confidence_score,
            created_by = EXCLUDED.created_by,
            created_at = NOW()
        `;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Index contract clauses for detailed analysis
   */
  async indexContractClauses(contractId: string, clauses: ContractClause[]): Promise<void> {
    try {
      // First, remove existing clauses for this contract
      await this.prisma.$executeRaw`
        DELETE FROM contract_clauses WHERE contract_id = ${contractId}
      `;

      // Insert new clauses
      for (const clause of clauses) {
        await this.prisma.$executeRaw`
          INSERT INTO contract_clauses (
            contract_id, clause_type, clause_title, clause_text,
            page_number, section_number, risk_level, compliance_status, ai_summary
          ) VALUES (
            ${contractId}, ${clause.clauseType}, ${clause.clauseTitle}, ${clause.clauseText},
            ${clause.pageNumber}, ${clause.sectionNumber}, 
            ${clause.riskLevel}, ${clause.complianceStatus}, ${clause.aiSummary}
          )
        `;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add milestones and important dates
   */
  async addContractMilestones(contractId: string, milestones: ContractMilestone[]): Promise<void> {
    try {
      for (const milestone of milestones) {
        await this.prisma.$executeRaw`
          INSERT INTO contract_milestones (
            contract_id, milestone_type, milestone_name, due_date,
            completed_date, status, description, reminder_days
          ) VALUES (
            ${contractId}, ${milestone.milestoneType}, ${milestone.milestoneName}, ${milestone.dueDate},
            ${milestone.completedDate}, ${milestone.status}, ${milestone.description}, ${milestone.reminderDays}
          )
        `;
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Intelligent contract search with AI-powered relevance scoring
   */
  async searchContracts(searchQuery: SearchQuery): Promise<SearchResult> {
    try {
      const conditions: Prisma.Sql[] = [];

      // Build dynamic WHERE conditions based on filters
      if (searchQuery.filters) {
        const { filters } = searchQuery;

        if (filters.contractType && filters.contractType.length > 0) {
          conditions.push(Prisma.sql`cm.contract_type = ANY(${filters.contractType})`);
        }

        if (filters.status && filters.status.length > 0) {
          conditions.push(Prisma.sql`cm.status = ANY(${filters.status})`);
        }

        if (filters.riskScoreRange) {
          conditions.push(
            Prisma.sql`cm.risk_score BETWEEN ${filters.riskScoreRange[0]} AND ${filters.riskScoreRange[1]}`
          );
        }

        if (filters.valueRange) {
          conditions.push(
            Prisma.sql`cm.total_value BETWEEN ${filters.valueRange[0]} AND ${filters.valueRange[1]}`
          );
        }

        if (filters.expirationDateRange) {
          conditions.push(
            Prisma.sql`cm.expiration_date BETWEEN ${filters.expirationDateRange[0]} AND ${filters.expirationDateRange[1]}`
          );
        }

        if (filters.clientName) {
          conditions.push(Prisma.sql`cm.client_name ILIKE ${'%' + filters.clientName + '%'}`);
        }

        if (filters.vendorName) {
          conditions.push(Prisma.sql`cm.vendor_name ILIKE ${'%' + filters.vendorName + '%'}`);
        }
      }

      // Add full-text search condition if query provided
      if (searchQuery.query) {
        conditions.push(
          Prisma.sql`cm.search_vector @@ plainto_tsquery('english', ${searchQuery.query})`
        );
      }

      const whereClause = conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.raw('WHERE 1=1');

      // Build ORDER BY clause — whitelist column names to prevent SQL injection
      const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'contract_type', 'total_value', 'risk_score', 'expiration_date', 'start_date', 'end_date', 'title'];
      const safeSortBy = ALLOWED_SORT_COLUMNS.includes(searchQuery.sortBy || '') ? searchQuery.sortBy! : 'created_at';
      const safeSortOrder = searchQuery.sortOrder === 'ASC' ? 'ASC' : 'DESC';

      const relevanceOrderFragment = searchQuery.query
        ? Prisma.sql`ts_rank(cm.search_vector, plainto_tsquery('english', ${searchQuery.query})) DESC,`
        : Prisma.empty;
      const sortFragment = Prisma.raw(`cm.${safeSortBy} ${safeSortOrder}`);

      // Build relevance score column
      const relevanceScoreFragment = searchQuery.query
        ? Prisma.sql`ts_rank(cm.search_vector, plainto_tsquery('english', ${searchQuery.query})) as relevance_score`
        : Prisma.raw('0 as relevance_score');

      // Build LIMIT and OFFSET
      const limit = searchQuery.limit || 50;
      const offset = searchQuery.offset || 0;

      const contracts = await this.prisma.$queryRaw`
        SELECT 
          c.id,
          c.name,
          c.status as contract_status,
          cm.*,
          COALESCE(
            array_agg(DISTINCT ct.tag_name) FILTER (WHERE ct.tag_name IS NOT NULL),
            ARRAY[]::text[]
          ) as tags,
          ${relevanceScoreFragment}
        FROM contracts c
        LEFT JOIN contract_metadata cm ON c.id = cm.contract_id
        LEFT JOIN contract_tags ct ON c.id = ct.contract_id
        ${whereClause}
        GROUP BY c.id, c.name, c.status, cm.id
        ORDER BY ${relevanceOrderFragment} ${sortFragment}
        LIMIT ${limit} OFFSET ${offset}
      `;

      // Get total count
      const countResult = await this.prisma.$queryRaw`
        SELECT COUNT(DISTINCT c.id) as total
        FROM contracts c
        LEFT JOIN contract_metadata cm ON c.id = cm.contract_id
        ${whereClause}
      ` as any[];
      const total = parseInt(countResult[0]?.total || '0');

      // Get aggregations for faceted search
      const aggregations = await this.getSearchAggregations(searchQuery);

      return {
        contracts: contracts as any[],
        total,
        aggregations
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get search aggregations for faceted search
   */
  private async getSearchAggregations(searchQuery: SearchQuery): Promise<any> {
    try {
      const contractTypes = await this.prisma.$queryRaw`
        SELECT contract_type, COUNT(*) as count
        FROM contract_metadata
        WHERE contract_type IS NOT NULL
        GROUP BY contract_type
        ORDER BY count DESC
      `;

      const riskDistribution = await this.prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN risk_score <= 30 THEN 'Low'
            WHEN risk_score <= 60 THEN 'Medium'
            ELSE 'High'
          END as risk_level,
          COUNT(*) as count
        FROM contract_metadata
        WHERE risk_score IS NOT NULL
        GROUP BY risk_level
      `;

      const statusDistribution = await this.prisma.$queryRaw`
        SELECT status, COUNT(*) as count
        FROM contract_metadata
        WHERE status IS NOT NULL
        GROUP BY status
        ORDER BY count DESC
      `;

      return {
        contractTypes: Object.fromEntries(
          (contractTypes as any[]).map(item => [item.contract_type, parseInt(item.count)])
        ),
        riskDistribution: Object.fromEntries(
          (riskDistribution as any[]).map(item => [item.risk_level, parseInt(item.count)])
        ),
        statusDistribution: Object.fromEntries(
          (statusDistribution as any[]).map(item => [item.status, parseInt(item.count)])
        )
      };
    } catch {
      return {};
    }
  }

  /**
   * Get contracts expiring soon
   */
  async getExpiringContracts(days: number = 90): Promise<any[]> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM expiring_contracts
        WHERE days_until_expiration <= ${days}
        ORDER BY days_until_expiration ASC
      `;
      return result as any[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get high-risk contracts
   */
  async getHighRiskContracts(riskThreshold: number = 70): Promise<any[]> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM high_risk_contracts
        WHERE risk_score >= ${riskThreshold}
        ORDER BY risk_score DESC
      `;
      return result as any[];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get contract analytics dashboard data
   */
  async getDashboardAnalytics(): Promise<any> {
    try {
      const totalContracts = await this.prisma.$queryRaw`
        SELECT COUNT(*) as total FROM contracts
      `;

      const totalValue = await this.prisma.$queryRaw`
        SELECT SUM(total_value) as total_value, currency
        FROM contract_metadata
        WHERE total_value IS NOT NULL
        GROUP BY currency
      `;

      const riskDistribution = await this.prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN risk_score <= 30 THEN 'Low'
            WHEN risk_score <= 60 THEN 'Medium'
            ELSE 'High'
          END as risk_level,
          COUNT(*) as count
        FROM contract_metadata
        WHERE risk_score IS NOT NULL
        GROUP BY risk_level
      `;

      const expiringCount = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM contract_metadata
        WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      `;

      const avgComplianceScore = await this.prisma.$queryRaw`
        SELECT AVG(compliance_score) as avg_score
        FROM contract_metadata
        WHERE compliance_score IS NOT NULL
      `;

      return {
        totalContracts: parseInt((totalContracts as any[])[0]?.total || '0'),
        totalValue: totalValue as any[],
        riskDistribution: riskDistribution as any[],
        expiringCount: parseInt((expiringCount as any[])[0]?.count || '0'),
        avgComplianceScore: parseFloat((avgComplianceScore as any[])[0]?.avg_score || '0')
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update contract risk score
   */
  async updateRiskScore(contractId: string, riskScore: number): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE contract_metadata 
        SET risk_score = ${riskScore}, updated_at = NOW()
        WHERE contract_id = ${contractId}
      `;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get contract recommendations based on AI analysis
   */
  async getContractRecommendations(contractId: string): Promise<any[]> {
    try {
      // This would integrate with AI services to provide recommendations
      // For now, return mock recommendations based on contract data
      const contract = await this.prisma.$queryRaw`
        SELECT cm.*, c.name
        FROM contract_metadata cm
        JOIN contracts c ON cm.contract_id = c.id
        WHERE cm.contract_id = ${contractId}
      `;

      if (!contract || (contract as any[]).length === 0) {
        return [];
      }

      const contractData = (contract as any[])[0];
      const recommendations = [];

      // Risk-based recommendations
      if (contractData.risk_score > 60) {
        recommendations.push({
          type: 'risk_mitigation',
          priority: 'high',
          title: 'High Risk Contract Detected',
          description: 'This contract has a high risk score. Consider reviewing liability clauses and adding additional protections.',
          action: 'Review liability terms'
        });
      }

      // Expiration recommendations
      if (contractData.expiration_date) {
        const daysUntilExpiration = Math.ceil(
          (new Date(contractData.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysUntilExpiration <= 90 && daysUntilExpiration > 0) {
          recommendations.push({
            type: 'renewal_reminder',
            priority: 'medium',
            title: 'Contract Expiring Soon',
            description: `This contract expires in ${daysUntilExpiration} days. Consider starting renewal negotiations.`,
            action: 'Start renewal process'
          });
        }
      }

      // Compliance recommendations
      if (contractData.compliance_score < 80) {
        recommendations.push({
          type: 'compliance_improvement',
          priority: 'medium',
          title: 'Compliance Score Below Threshold',
          description: 'This contract has compliance issues that should be addressed.',
          action: 'Review compliance requirements'
        });
      }

      return recommendations;
    } catch (error) {
      throw error;
    }
  }
}