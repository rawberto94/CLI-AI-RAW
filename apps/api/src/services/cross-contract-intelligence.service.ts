/**
 * Cross-Contract Intelligence Service
 * Provides intelligent analysis across multiple contracts including relationship mapping,
 * pattern recognition, and benchmarking capabilities
 */

import pino from 'pino';

const logger = pino({ name: 'cross-contract-intelligence' });

export interface ContractRelationship {
  id: string;
  sourceContractId: string;
  targetContractId: string;
  relationshipType: RelationshipType;
  strength: number; // 0-1 confidence score
  description: string;
  identifiedBy: string[]; // Methods used to identify relationship
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum RelationshipType {
  AMENDMENT = 'amendment',
  RENEWAL = 'renewal',
  MASTER_AGREEMENT = 'master_agreement',
  STATEMENT_OF_WORK = 'statement_of_work',
  ADDENDUM = 'addendum',
  RELATED_PARTY = 'related_party',
  SIMILAR_TERMS = 'similar_terms',
  COMPETITIVE_BID = 'competitive_bid',
  FRAMEWORK_AGREEMENT = 'framework_agreement',
  DUPLICATE = 'duplicate'
}

export interface ContractPattern {
  id: string;
  patternType: PatternType;
  name: string;
  description: string;
  frequency: number;
  contracts: string[];
  characteristics: PatternCharacteristic[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  confidence: number;
  identifiedAt: Date;
}

export enum PatternType {
  FINANCIAL_TERMS = 'financial_terms',
  PAYMENT_STRUCTURE = 'payment_structure',
  RISK_ALLOCATION = 'risk_allocation',
  TERMINATION_CLAUSES = 'termination_clauses',
  COMPLIANCE_REQUIREMENTS = 'compliance_requirements',
  PERFORMANCE_METRICS = 'performance_metrics',
  VENDOR_BEHAVIOR = 'vendor_behavior',
  GEOGRAPHIC_CLUSTERING = 'geographic_clustering'
}

export interface PatternCharacteristic {
  name: string;
  value: any;
  frequency: number;
  variance: number;
}

export interface BenchmarkResult {
  contractId: string;
  category: BenchmarkCategory;
  metric: string;
  value: number;
  percentile: number;
  industryAverage: number;
  peerComparison: PeerComparison[];
  recommendations: BenchmarkRecommendation[];
  confidence: number;
  benchmarkedAt: Date;
}

export enum BenchmarkCategory {
  FINANCIAL = 'financial',
  TERMS = 'terms',
  RISK = 'risk',
  PERFORMANCE = 'performance',
  COMPLIANCE = 'compliance'
}

export interface PeerComparison {
  contractId: string;
  similarity: number;
  value: number;
  variance: number;
}

export interface BenchmarkRecommendation {
  type: 'optimization' | 'risk_mitigation' | 'cost_reduction' | 'term_improvement';
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

export interface PortfolioInsight {
  id: string;
  tenantId: string;
  category: InsightCategory;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  affectedContracts: string[];
  recommendations: string[];
  potentialSavings?: number;
  riskReduction?: number;
  generatedAt: Date;
}

export enum InsightCategory {
  COST_OPTIMIZATION = 'cost_optimization',
  RISK_MANAGEMENT = 'risk_management',
  COMPLIANCE_GAP = 'compliance_gap',
  PROCESS_IMPROVEMENT = 'process_improvement',
  VENDOR_CONSOLIDATION = 'vendor_consolidation',
  TERM_STANDARDIZATION = 'term_standardization'
}

export class CrossContractIntelligenceService {
  private relationships = new Map<string, ContractRelationship[]>();
  private patterns = new Map<string, ContractPattern[]>();
  private benchmarks = new Map<string, BenchmarkResult[]>();
  private insights = new Map<string, PortfolioInsight[]>();

  /**
   * Analyze relationships between contracts
   */
  async analyzeContractRelationships(
    contractId: string, 
    tenantId: string, 
    existingContracts: any[]
  ): Promise<ContractRelationship[]> {
    try {
      logger.info({ contractId, tenantId, existingCount: existingContracts.length }, 'Analyzing contract relationships');

      const relationships: ContractRelationship[] = [];
      const targetContract = existingContracts.find(c => c.id === contractId);
      
      if (!targetContract) {
        logger.warn({ contractId }, 'Target contract not found for relationship analysis');
        return relationships;
      }

      for (const contract of existingContracts) {
        if (contract.id === contractId) continue;

        const relationship = await this.identifyRelationship(targetContract, contract);
        if (relationship) {
          relationships.push(relationship);
        }
      }

      // Store relationships
      this.relationships.set(contractId, relationships);

      logger.info({ 
        contractId, 
        relationshipsFound: relationships.length 
      }, 'Contract relationship analysis completed');

      return relationships;
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to analyze contract relationships');
      throw error;
    }
  }

  /**
   * Identify relationship between two contracts
   */
  private async identifyRelationship(
    contract1: any, 
    contract2: any
  ): Promise<ContractRelationship | null> {
    const identificationMethods: string[] = [];
    let relationshipType: RelationshipType | null = null;
    let strength = 0;
    let description = '';

    // Check for party overlap
    const partyOverlap = this.checkPartyOverlap(contract1, contract2);
    if (partyOverlap.hasOverlap) {
      identificationMethods.push('party_overlap');
      strength += partyOverlap.strength;
    }

    // Check for reference numbers or IDs
    const referenceMatch = this.checkReferenceMatch(contract1, contract2);
    if (referenceMatch.hasMatch) {
      identificationMethods.push('reference_match');
      relationshipType = referenceMatch.type;
      strength += referenceMatch.strength;
      description = referenceMatch.description;
    }

    // Check for similar terms and conditions
    const termSimilarity = this.checkTermSimilarity(contract1, contract2);
    if (termSimilarity.similarity > 0.7) {
      identificationMethods.push('term_similarity');
      if (!relationshipType) {
        relationshipType = RelationshipType.SIMILAR_TERMS;
      }
      strength += termSimilarity.similarity * 0.3;
    }

    // Check for temporal relationships
    const temporalRelation = this.checkTemporalRelationship(contract1, contract2);
    if (temporalRelation.hasRelation) {
      identificationMethods.push('temporal_analysis');
      if (!relationshipType) {
        relationshipType = temporalRelation.type;
      }
      strength += temporalRelation.strength;
    }

    // Only create relationship if strength is above threshold
    if (strength > 0.3 && relationshipType && identificationMethods.length > 0) {
      return {
        id: `rel-${contract1.id}-${contract2.id}-${Date.now()}`,
        sourceContractId: contract1.id,
        targetContractId: contract2.id,
        relationshipType,
        strength: Math.min(strength, 1),
        description: description || `${relationshipType} relationship identified`,
        identifiedBy: identificationMethods,
        metadata: {
          partyOverlap: partyOverlap.hasOverlap,
          termSimilarity: termSimilarity.similarity,
          temporalRelation: temporalRelation.hasRelation
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return null;
  }

  /**
   * Check for party overlap between contracts
   */
  private checkPartyOverlap(contract1: any, contract2: any): {
    hasOverlap: boolean;
    strength: number;
    overlappingParties: string[];
  } {
    const parties1 = this.extractParties(contract1);
    const parties2 = this.extractParties(contract2);
    
    const overlapping = parties1.filter(p1 => 
      parties2.some(p2 => this.normalizePartyName(p1) === this.normalizePartyName(p2))
    );

    const strength = overlapping.length > 0 ? 
      (overlapping.length / Math.max(parties1.length, parties2.length)) * 0.4 : 0;

    return {
      hasOverlap: overlapping.length > 0,
      strength,
      overlappingParties: overlapping
    };
  }

  /**
   * Check for reference matches (amendments, renewals, etc.)
   */
  private checkReferenceMatch(contract1: any, contract2: any): {
    hasMatch: boolean;
    type: RelationshipType;
    strength: number;
    description: string;
  } {
    const content1 = (contract1.content || '').toLowerCase();
    const content2 = (contract2.content || '').toLowerCase();
    
    // Check for amendment references
    if (content1.includes('amend') && (content1.includes(contract2.id) || content2.includes(contract1.id))) {
      return {
        hasMatch: true,
        type: RelationshipType.AMENDMENT,
        strength: 0.8,
        description: 'Amendment relationship detected through document references'
      };
    }

    // Check for renewal references
    if ((content1.includes('renew') || content1.includes('extend')) && 
        (content1.includes(contract2.id) || content2.includes(contract1.id))) {
      return {
        hasMatch: true,
        type: RelationshipType.RENEWAL,
        strength: 0.7,
        description: 'Renewal relationship detected through document references'
      };
    }

    // Check for master agreement references
    if (content1.includes('master agreement') || content2.includes('master agreement')) {
      return {
        hasMatch: true,
        type: RelationshipType.MASTER_AGREEMENT,
        strength: 0.6,
        description: 'Master agreement relationship detected'
      };
    }

    return {
      hasMatch: false,
      type: RelationshipType.SIMILAR_TERMS,
      strength: 0,
      description: ''
    };
  }

  /**
   * Check term similarity between contracts
   */
  private checkTermSimilarity(contract1: any, contract2: any): {
    similarity: number;
    commonTerms: string[];
  } {
    const terms1 = this.extractKeyTerms(contract1);
    const terms2 = this.extractKeyTerms(contract2);
    
    const commonTerms = terms1.filter(term => terms2.includes(term));
    const similarity = commonTerms.length / Math.max(terms1.length, terms2.length, 1);

    return {
      similarity,
      commonTerms
    };
  }

  /**
   * Check temporal relationships between contracts
   */
  private checkTemporalRelationship(contract1: any, contract2: any): {
    hasRelation: boolean;
    type: RelationshipType;
    strength: number;
  } {
    const date1 = new Date(contract1.createdAt || contract1.effectiveDate);
    const date2 = new Date(contract2.createdAt || contract2.effectiveDate);
    
    const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
    
    // If contracts are very close in time and have party overlap, likely related
    if (daysDiff < 30) {
      return {
        hasRelation: true,
        type: RelationshipType.RELATED_PARTY,
        strength: Math.max(0, (30 - daysDiff) / 30) * 0.3
      };
    }

    return {
      hasRelation: false,
      type: RelationshipType.SIMILAR_TERMS,
      strength: 0
    };
  }

  /**
   * Identify patterns across contract portfolio
   */
  async identifyContractPatterns(tenantId: string, contracts: any[]): Promise<ContractPattern[]> {
    try {
      logger.info({ tenantId, contractCount: contracts.length }, 'Identifying contract patterns');

      const patterns: ContractPattern[] = [];

      // Analyze financial patterns
      const financialPatterns = await this.analyzeFinancialPatterns(contracts);
      patterns.push(...financialPatterns);

      // Analyze risk patterns
      const riskPatterns = await this.analyzeRiskPatterns(contracts);
      patterns.push(...riskPatterns);

      // Analyze compliance patterns
      const compliancePatterns = await this.analyzeCompliancePatterns(contracts);
      patterns.push(...compliancePatterns);

      // Analyze vendor patterns
      const vendorPatterns = await this.analyzeVendorPatterns(contracts);
      patterns.push(...vendorPatterns);

      // Store patterns
      this.patterns.set(tenantId, patterns);

      logger.info({ 
        tenantId, 
        patternsFound: patterns.length 
      }, 'Contract pattern analysis completed');

      return patterns;
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to identify contract patterns');
      throw error;
    }
  }

  /**
   * Analyze financial patterns across contracts
   */
  private async analyzeFinancialPatterns(contracts: any[]): Promise<ContractPattern[]> {
    const patterns: ContractPattern[] = [];
    
    // Group contracts by financial characteristics
    const paymentTermGroups = this.groupByPaymentTerms(contracts);
    const valueRangeGroups = this.groupByValueRanges(contracts);
    
    // Identify common payment term patterns
    for (const [terms, contractGroup] of paymentTermGroups.entries()) {
      if (contractGroup.length >= 3) { // Pattern needs at least 3 contracts
        patterns.push({
          id: `pattern-payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patternType: PatternType.PAYMENT_STRUCTURE,
          name: `Common Payment Terms: ${terms}`,
          description: `${contractGroup.length} contracts share similar payment terms`,
          frequency: contractGroup.length,
          contracts: contractGroup.map(c => c.id),
          characteristics: [
            {
              name: 'payment_terms',
              value: terms,
              frequency: contractGroup.length,
              variance: 0
            }
          ],
          riskLevel: 'low',
          recommendations: [
            'Consider standardizing payment terms across all contracts',
            'Negotiate better terms based on volume'
          ],
          confidence: 0.8,
          identifiedAt: new Date()
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze risk patterns across contracts
   */
  private async analyzeRiskPatterns(contracts: any[]): Promise<ContractPattern[]> {
    const patterns: ContractPattern[] = [];
    
    // Analyze risk allocation patterns
    const riskAllocationGroups = this.groupByRiskAllocation(contracts);
    
    for (const [allocation, contractGroup] of riskAllocationGroups.entries()) {
      if (contractGroup.length >= 2) {
        const riskLevel = this.assessRiskLevel(allocation);
        
        patterns.push({
          id: `pattern-risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patternType: PatternType.RISK_ALLOCATION,
          name: `Risk Allocation Pattern: ${allocation}`,
          description: `${contractGroup.length} contracts have similar risk allocation`,
          frequency: contractGroup.length,
          contracts: contractGroup.map(c => c.id),
          characteristics: [
            {
              name: 'risk_allocation',
              value: allocation,
              frequency: contractGroup.length,
              variance: 0.1
            }
          ],
          riskLevel,
          recommendations: this.getRiskRecommendations(allocation, riskLevel),
          confidence: 0.7,
          identifiedAt: new Date()
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze compliance patterns across contracts
   */
  private async analyzeCompliancePatterns(contracts: any[]): Promise<ContractPattern[]> {
    const patterns: ContractPattern[] = [];
    
    // Group by compliance requirements
    const complianceGroups = this.groupByComplianceRequirements(contracts);
    
    for (const [requirement, contractGroup] of complianceGroups.entries()) {
      if (contractGroup.length >= 2) {
        patterns.push({
          id: `pattern-compliance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patternType: PatternType.COMPLIANCE_REQUIREMENTS,
          name: `Compliance Requirement: ${requirement}`,
          description: `${contractGroup.length} contracts require ${requirement} compliance`,
          frequency: contractGroup.length,
          contracts: contractGroup.map(c => c.id),
          characteristics: [
            {
              name: 'compliance_requirement',
              value: requirement,
              frequency: contractGroup.length,
              variance: 0
            }
          ],
          riskLevel: 'medium',
          recommendations: [
            `Ensure consistent ${requirement} compliance across all contracts`,
            'Consider creating compliance templates'
          ],
          confidence: 0.75,
          identifiedAt: new Date()
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze vendor patterns across contracts
   */
  private async analyzeVendorPatterns(contracts: any[]): Promise<ContractPattern[]> {
    const patterns: ContractPattern[] = [];
    
    // Group by vendor
    const vendorGroups = this.groupByVendor(contracts);
    
    for (const [vendor, contractGroup] of vendorGroups.entries()) {
      if (contractGroup.length >= 3) {
        patterns.push({
          id: `pattern-vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          patternType: PatternType.VENDOR_BEHAVIOR,
          name: `Vendor Pattern: ${vendor}`,
          description: `${contractGroup.length} contracts with ${vendor}`,
          frequency: contractGroup.length,
          contracts: contractGroup.map(c => c.id),
          characteristics: [
            {
              name: 'vendor_name',
              value: vendor,
              frequency: contractGroup.length,
              variance: 0
            }
          ],
          riskLevel: 'low',
          recommendations: [
            'Consider volume discounts with this vendor',
            'Standardize terms across all contracts with this vendor'
          ],
          confidence: 0.9,
          identifiedAt: new Date()
        });
      }
    }

    return patterns;
  }

  /**
   * Generate portfolio-level insights
   */
  async generatePortfolioInsights(tenantId: string, contracts: any[]): Promise<PortfolioInsight[]> {
    try {
      logger.info({ tenantId, contractCount: contracts.length }, 'Generating portfolio insights');

      const insights: PortfolioInsight[] = [];

      // Cost optimization insights
      const costInsights = await this.generateCostOptimizationInsights(tenantId, contracts);
      insights.push(...costInsights);

      // Risk management insights
      const riskInsights = await this.generateRiskManagementInsights(tenantId, contracts);
      insights.push(...riskInsights);

      // Compliance insights
      const complianceInsights = await this.generateComplianceInsights(tenantId, contracts);
      insights.push(...complianceInsights);

      // Vendor consolidation insights
      const vendorInsights = await this.generateVendorConsolidationInsights(tenantId, contracts);
      insights.push(...vendorInsights);

      // Store insights
      this.insights.set(tenantId, insights);

      logger.info({ 
        tenantId, 
        insightsGenerated: insights.length 
      }, 'Portfolio insights generation completed');

      return insights;
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to generate portfolio insights');
      throw error;
    }
  }

  // Helper methods for pattern analysis
  private groupByPaymentTerms(contracts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    contracts.forEach(contract => {
      const paymentTerms = this.extractPaymentTerms(contract);
      if (!groups.has(paymentTerms)) {
        groups.set(paymentTerms, []);
      }
      groups.get(paymentTerms)!.push(contract);
    });
    
    return groups;
  }

  private groupByValueRanges(contracts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    contracts.forEach(contract => {
      const valueRange = this.getValueRange(contract);
      if (!groups.has(valueRange)) {
        groups.set(valueRange, []);
      }
      groups.get(valueRange)!.push(contract);
    });
    
    return groups;
  }

  private groupByRiskAllocation(contracts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    contracts.forEach(contract => {
      const riskAllocation = this.extractRiskAllocation(contract);
      if (!groups.has(riskAllocation)) {
        groups.set(riskAllocation, []);
      }
      groups.get(riskAllocation)!.push(contract);
    });
    
    return groups;
  }

  private groupByComplianceRequirements(contracts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    contracts.forEach(contract => {
      const requirements = this.extractComplianceRequirements(contract);
      requirements.forEach(req => {
        if (!groups.has(req)) {
          groups.set(req, []);
        }
        groups.get(req)!.push(contract);
      });
    });
    
    return groups;
  }

  private groupByVendor(contracts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    contracts.forEach(contract => {
      const vendor = this.extractVendor(contract);
      if (vendor) {
        if (!groups.has(vendor)) {
          groups.set(vendor, []);
        }
        groups.get(vendor)!.push(contract);
      }
    });
    
    return groups;
  }

  // Extraction helper methods
  private extractParties(contract: any): string[] {
    // Extract parties from contract data
    const parties = [];
    if (contract.parties) {
      parties.push(...contract.parties);
    }
    // Add more extraction logic based on your contract structure
    return parties;
  }

  private extractKeyTerms(contract: any): string[] {
    // Extract key terms from contract
    const terms = [];
    if (contract.keyTerms) {
      terms.push(...contract.keyTerms);
    }
    // Add more extraction logic
    return terms;
  }

  private extractPaymentTerms(contract: any): string {
    // Extract payment terms
    return contract.paymentTerms || 'unknown';
  }

  private getValueRange(contract: any): string {
    const value = contract.totalValue || 0;
    if (value < 10000) return 'small';
    if (value < 100000) return 'medium';
    if (value < 1000000) return 'large';
    return 'enterprise';
  }

  private extractRiskAllocation(contract: any): string {
    // Extract risk allocation pattern
    return contract.riskAllocation || 'balanced';
  }

  private extractComplianceRequirements(contract: any): string[] {
    // Extract compliance requirements
    return contract.complianceRequirements || [];
  }

  private extractVendor(contract: any): string | null {
    // Extract vendor name
    return contract.vendor || contract.supplier || null;
  }

  private normalizePartyName(name: string): string {
    return name.toLowerCase().trim().replace(/[^\w\s]/g, '');
  }

  private assessRiskLevel(allocation: string): 'low' | 'medium' | 'high' {
    // Assess risk level based on allocation
    if (allocation.includes('high') || allocation.includes('customer')) {
      return 'high';
    }
    if (allocation.includes('shared') || allocation.includes('balanced')) {
      return 'medium';
    }
    return 'low';
  }

  private getRiskRecommendations(allocation: string, riskLevel: 'low' | 'medium' | 'high'): string[] {
    const recommendations = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Consider renegotiating risk allocation');
      recommendations.push('Implement additional risk mitigation measures');
    }
    
    recommendations.push('Review insurance coverage');
    recommendations.push('Standardize risk allocation across similar contracts');
    
    return recommendations;
  }

  // Insight generation methods
  private async generateCostOptimizationInsights(tenantId: string, contracts: any[]): Promise<PortfolioInsight[]> {
    const insights: PortfolioInsight[] = [];
    
    // Analyze total contract value and identify optimization opportunities
    const totalValue = contracts.reduce((sum, contract) => sum + (contract.totalValue || 0), 0);
    const averageValue = totalValue / contracts.length;
    
    // Find contracts with above-average values for similar services
    const highValueContracts = contracts.filter(c => (c.totalValue || 0) > averageValue * 1.5);
    
    if (highValueContracts.length > 0) {
      insights.push({
        id: `insight-cost-${Date.now()}`,
        tenantId,
        category: InsightCategory.COST_OPTIMIZATION,
        title: 'High-Value Contract Optimization Opportunity',
        description: `${highValueContracts.length} contracts have significantly higher values than average`,
        impact: 'high',
        confidence: 0.8,
        affectedContracts: highValueContracts.map(c => c.id),
        recommendations: [
          'Review pricing structures for high-value contracts',
          'Negotiate volume discounts',
          'Consider contract consolidation'
        ],
        potentialSavings: totalValue * 0.1, // Estimate 10% savings
        generatedAt: new Date()
      });
    }
    
    return insights;
  }

  private async generateRiskManagementInsights(tenantId: string, contracts: any[]): Promise<PortfolioInsight[]> {
    const insights: PortfolioInsight[] = [];
    
    // Identify contracts with high risk exposure
    const highRiskContracts = contracts.filter(c => 
      c.riskScore && c.riskScore > 7 // Assuming risk score 1-10
    );
    
    if (highRiskContracts.length > 0) {
      insights.push({
        id: `insight-risk-${Date.now()}`,
        tenantId,
        category: InsightCategory.RISK_MANAGEMENT,
        title: 'High-Risk Contract Portfolio',
        description: `${highRiskContracts.length} contracts have elevated risk scores`,
        impact: 'high',
        confidence: 0.9,
        affectedContracts: highRiskContracts.map(c => c.id),
        recommendations: [
          'Implement enhanced monitoring for high-risk contracts',
          'Review and update risk mitigation strategies',
          'Consider contract renegotiation'
        ],
        riskReduction: 30, // Estimate 30% risk reduction
        generatedAt: new Date()
      });
    }
    
    return insights;
  }

  private async generateComplianceInsights(tenantId: string, contracts: any[]): Promise<PortfolioInsight[]> {
    const insights: PortfolioInsight[] = [];
    
    // Identify compliance gaps
    const complianceGaps = this.identifyComplianceGaps(contracts);
    
    if (complianceGaps.length > 0) {
      insights.push({
        id: `insight-compliance-${Date.now()}`,
        tenantId,
        category: InsightCategory.COMPLIANCE_GAP,
        title: 'Compliance Standardization Opportunity',
        description: `Inconsistent compliance requirements across ${complianceGaps.length} contract areas`,
        impact: 'medium',
        confidence: 0.7,
        affectedContracts: contracts.map(c => c.id),
        recommendations: [
          'Standardize compliance requirements',
          'Create compliance templates',
          'Implement regular compliance audits'
        ],
        generatedAt: new Date()
      });
    }
    
    return insights;
  }

  private async generateVendorConsolidationInsights(tenantId: string, contracts: any[]): Promise<PortfolioInsight[]> {
    const insights: PortfolioInsight[] = [];
    
    // Analyze vendor distribution
    const vendorGroups = this.groupByVendor(contracts);
    const multipleVendorServices = this.identifyMultipleVendorServices(contracts);
    
    if (multipleVendorServices.length > 0) {
      insights.push({
        id: `insight-vendor-${Date.now()}`,
        tenantId,
        category: InsightCategory.VENDOR_CONSOLIDATION,
        title: 'Vendor Consolidation Opportunity',
        description: `${multipleVendorServices.length} services are provided by multiple vendors`,
        impact: 'medium',
        confidence: 0.6,
        affectedContracts: contracts.map(c => c.id),
        recommendations: [
          'Evaluate vendor consolidation opportunities',
          'Negotiate better terms through volume',
          'Standardize vendor selection criteria'
        ],
        potentialSavings: contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0) * 0.05,
        generatedAt: new Date()
      });
    }
    
    return insights;
  }

  private identifyComplianceGaps(contracts: any[]): string[] {
    // Identify areas where compliance requirements are inconsistent
    const complianceMap = new Map<string, Set<string>>();
    
    contracts.forEach(contract => {
      const service = contract.serviceType || 'unknown';
      const requirements = this.extractComplianceRequirements(contract);
      
      if (!complianceMap.has(service)) {
        complianceMap.set(service, new Set());
      }
      
      requirements.forEach(req => complianceMap.get(service)!.add(req));
    });
    
    // Find services with varying compliance requirements
    const gaps: string[] = [];
    complianceMap.forEach((requirements, service) => {
      if (requirements.size > 1) {
        gaps.push(service);
      }
    });
    
    return gaps;
  }

  private identifyMultipleVendorServices(contracts: any[]): string[] {
    const serviceVendorMap = new Map<string, Set<string>>();
    
    contracts.forEach(contract => {
      const service = contract.serviceType || 'unknown';
      const vendor = this.extractVendor(contract);
      
      if (vendor) {
        if (!serviceVendorMap.has(service)) {
          serviceVendorMap.set(service, new Set());
        }
        serviceVendorMap.get(service)!.add(vendor);
      }
    });
    
    const multipleVendorServices: string[] = [];
    serviceVendorMap.forEach((vendors, service) => {
      if (vendors.size > 1) {
        multipleVendorServices.push(service);
      }
    });
    
    return multipleVendorServices;
  }

  /**
   * Get relationships for a contract
   */
  getContractRelationships(contractId: string): ContractRelationship[] {
    return this.relationships.get(contractId) || [];
  }

  /**
   * Get patterns for a tenant
   */
  getTenantPatterns(tenantId: string): ContractPattern[] {
    return this.patterns.get(tenantId) || [];
  }

  /**
   * Get insights for a tenant
   */
  getTenantInsights(tenantId: string): PortfolioInsight[] {
    return this.insights.get(tenantId) || [];
  }

  /**
   * Clear cached data for a tenant
   */
  clearTenantData(tenantId: string): void {
    this.patterns.delete(tenantId);
    this.insights.delete(tenantId);
    
    // Clear relationships for all contracts of this tenant
    for (const [contractId, relationships] of this.relationships.entries()) {
      // In a real implementation, you'd filter by tenantId
      // For now, we'll keep the relationships
    }
    
    logger.info({ tenantId }, 'Cleared cross-contract intelligence data for tenant');
  }
}

export const crossContractIntelligenceService = new CrossContractIntelligenceService();