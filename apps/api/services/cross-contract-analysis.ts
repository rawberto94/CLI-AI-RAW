/**
 * Cross-Contract Analysis Service
 * Discovers relationships, similarities, and patterns across contracts
 */

export interface ContractRelationship {
  contractId1: string;
  contractId2: string;
  relationshipType: 'SIMILAR' | 'DEPENDENT' | 'CONFLICTING' | 'COMPLEMENTARY' | 'RENEWAL' | 'AMENDMENT';
  confidence: number;
  description: string;
  commonElements: string[];
  differences: string[];
  riskFactors?: string[];
}

export interface ContractCluster {
  id: string;
  name: string;
  contractIds: string[];
  commonCharacteristics: string[];
  averageValue: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  complianceScore: number;
}

export interface CrossContractInsight {
  type: 'PATTERN' | 'ANOMALY' | 'OPPORTUNITY' | 'RISK';
  title: string;
  description: string;
  affectedContracts: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  potentialImpact: string;
}

export interface BenchmarkData {
  contractType: string;
  metrics: {
    averageValue: number;
    averageTermLength: number;
    commonPaymentTerms: string[];
    riskDistribution: Record<string, number>;
    complianceScores: number[];
  };
  bestPractices: string[];
  commonIssues: string[];
}

export class CrossContractAnalysisService {
  /**
   * Discover relationships between contracts
   */
  async discoverRelationships(
    tenantId: string,
    contractIds?: string[]
  ): Promise<ContractRelationship[]> {
    try {
      // Get contracts to analyze
      const contracts = await this.getContractsForAnalysis(tenantId, contractIds);
      const relationships: ContractRelationship[] = [];

      // Compare each contract with every other contract
      for (let i = 0; i < contracts.length; i++) {
        for (let j = i + 1; j < contracts.length; j++) {
          const relationship = await this.analyzeContractPair(contracts[i], contracts[j]);
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }

      // Sort by confidence score
      return relationships.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error discovering contract relationships:', error);
      throw error;
    }
  }

  /**
   * Identify similar contracts and create clusters
   */
  async identifyContractClusters(
    tenantId: string,
    similarityThreshold = 0.7
  ): Promise<ContractCluster[]> {
    try {
      const contracts = await this.getContractsForAnalysis(tenantId);
      const clusters: ContractCluster[] = [];
      const processed = new Set<string>();

      for (const contract of contracts) {
        if (processed.has(contract.id)) continue;

        const similarContracts = await this.findSimilarContracts(
          contract,
          contracts,
          similarityThreshold
        );

        if (similarContracts.length > 1) {
          const cluster = await this.createCluster(similarContracts);
          clusters.push(cluster);
          
          // Mark contracts as processed
          similarContracts.forEach(c => processed.add(c.id));
        }
      }

      return clusters;
    } catch (error) {
      console.error('Error identifying contract clusters:', error);
      throw error;
    }
  }

  /**
   * Generate cross-contract insights
   */
  async generateInsights(tenantId: string): Promise<CrossContractInsight[]> {
    try {
      const contracts = await this.getContractsForAnalysis(tenantId);
      const insights: CrossContractInsight[] = [];

      // Analyze patterns
      insights.push(...await this.analyzePatterns(contracts));
      
      // Detect anomalies
      insights.push(...await this.detectAnomalies(contracts));
      
      // Identify opportunities
      insights.push(...await this.identifyOpportunities(contracts));
      
      // Assess risks
      insights.push(...await this.assessCrossContractRisks(contracts));

      return insights.sort((a, b) => {
        const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      console.error('Error generating cross-contract insights:', error);
      throw error;
    }
  }

  /**
   * Create benchmark data for contract types
   */
  async createBenchmarks(tenantId: string): Promise<BenchmarkData[]> {
    try {
      const contracts = await this.getContractsForAnalysis(tenantId);
      const contractsByType = this.groupContractsByType(contracts);
      const benchmarks: BenchmarkData[] = [];

      for (const [contractType, typeContracts] of contractsByType.entries()) {
        if (typeContracts.length < 3) continue; // Need minimum contracts for meaningful benchmark

        const benchmark = await this.calculateBenchmark(contractType, typeContracts);
        benchmarks.push(benchmark);
      }

      return benchmarks;
    } catch (error) {
      console.error('Error creating benchmarks:', error);
      throw error;
    }
  }

  /**
   * Compare contract against benchmarks
   */
  async compareAgainstBenchmarks(
    contractId: string,
    tenantId: string
  ): Promise<{
    contract: any;
    benchmarks: BenchmarkData[];
    comparisons: Array<{
      metric: string;
      contractValue: any;
      benchmarkValue: any;
      variance: number;
      assessment: 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
    }>;
    recommendations: string[];
  }> {
    try {
      const contract = await this.getContract(contractId, tenantId);
      const benchmarks = await this.createBenchmarks(tenantId);
      
      const relevantBenchmark = benchmarks.find(b => 
        b.contractType === contract.metadata?.contractType
      );

      if (!relevantBenchmark) {
        throw new Error(`No benchmark available for contract type: ${contract.metadata?.contractType}`);
      }

      const comparisons = this.performBenchmarkComparison(contract, relevantBenchmark);
      const recommendations = this.generateBenchmarkRecommendations(comparisons);

      return {
        contract,
        benchmarks,
        comparisons,
        recommendations
      };
    } catch (error) {
      console.error('Error comparing against benchmarks:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getContractsForAnalysis(tenantId: string, contractIds?: string[]): Promise<any[]> {
    // In a real implementation, this would fetch from the database
    // For now, return mock data
    return [
      {
        id: 'contract_001',
        tenantId,
        metadata: { contractType: 'Service Agreement', parties: ['Acme Corp', 'TechServices Inc'] },
        financial: { totalValue: 500000, currency: 'USD', paymentTerms: 'Net 30' },
        risk: { riskScore: 65, riskLevel: 'MEDIUM' },
        compliance: { complianceScore: 85 },
        extractedText: 'Service agreement between Acme Corp and TechServices Inc...',
        keywords: ['service', 'agreement', 'software', 'development']
      },
      {
        id: 'contract_002',
        tenantId,
        metadata: { contractType: 'Service Agreement', parties: ['Acme Corp', 'DataSolutions LLC'] },
        financial: { totalValue: 750000, currency: 'USD', paymentTerms: 'Net 30' },
        risk: { riskScore: 45, riskLevel: 'LOW' },
        compliance: { complianceScore: 92 },
        extractedText: 'Service agreement between Acme Corp and DataSolutions LLC...',
        keywords: ['service', 'agreement', 'data', 'analytics']
      },
      {
        id: 'contract_003',
        tenantId,
        metadata: { contractType: 'Purchase Order', parties: ['Acme Corp', 'Hardware Supplier'] },
        financial: { totalValue: 100000, currency: 'USD', paymentTerms: 'Net 15' },
        risk: { riskScore: 25, riskLevel: 'LOW' },
        compliance: { complianceScore: 78 },
        extractedText: 'Purchase order for hardware equipment...',
        keywords: ['purchase', 'order', 'hardware', 'equipment']
      }
    ];
  }

  private async getContract(contractId: string, tenantId: string): Promise<any> {
    const contracts = await this.getContractsForAnalysis(tenantId);
    return contracts.find(c => c.id === contractId);
  }

  private async analyzeContractPair(contract1: any, contract2: any): Promise<ContractRelationship | null> {
    // Calculate similarity score
    const similarity = this.calculateSimilarity(contract1, contract2);
    
    if (similarity < 0.3) return null; // Too dissimilar

    // Determine relationship type
    const relationshipType = this.determineRelationshipType(contract1, contract2, similarity);
    
    // Find common elements and differences
    const commonElements = this.findCommonElements(contract1, contract2);
    const differences = this.findDifferences(contract1, contract2);

    return {
      contractId1: contract1.id,
      contractId2: contract2.id,
      relationshipType,
      confidence: similarity,
      description: this.generateRelationshipDescription(relationshipType, commonElements),
      commonElements,
      differences,
      riskFactors: this.identifyRelationshipRisks(contract1, contract2, relationshipType)
    };
  }

  private calculateSimilarity(contract1: any, contract2: any): number {
    let score = 0;
    let factors = 0;

    // Contract type similarity
    if (contract1.metadata?.contractType === contract2.metadata?.contractType) {
      score += 0.3;
    }
    factors++;

    // Party similarity
    const parties1 = contract1.metadata?.parties || [];
    const parties2 = contract2.metadata?.parties || [];
    const commonParties = parties1.filter((p: string) => parties2.includes(p));
    if (commonParties.length > 0) {
      score += 0.2 * (commonParties.length / Math.max(parties1.length, parties2.length));
    }
    factors++;

    // Financial similarity
    if (contract1.financial && contract2.financial) {
      const valueDiff = Math.abs(contract1.financial.totalValue - contract2.financial.totalValue);
      const maxValue = Math.max(contract1.financial.totalValue, contract2.financial.totalValue);
      const valueSimilarity = 1 - (valueDiff / maxValue);
      score += 0.2 * valueSimilarity;

      if (contract1.financial.currency === contract2.financial.currency) {
        score += 0.1;
      }
      factors += 2;
    }

    // Keyword similarity
    const keywords1 = contract1.keywords || [];
    const keywords2 = contract2.keywords || [];
    const commonKeywords = keywords1.filter((k: string) => keywords2.includes(k));
    const keywordSimilarity = commonKeywords.length / Math.max(keywords1.length, keywords2.length, 1);
    score += 0.2 * keywordSimilarity;
    factors++;

    return Math.min(score, 1.0);
  }

  private determineRelationshipType(contract1: any, contract2: any, similarity: number): ContractRelationship['relationshipType'] {
    // Check for common parties (might indicate dependency or renewal)
    const parties1 = contract1.metadata?.parties || [];
    const parties2 = contract2.metadata?.parties || [];
    const hasCommonParties = parties1.some((p: string) => parties2.includes(p));

    if (hasCommonParties && similarity > 0.8) {
      return 'RENEWAL';
    }

    if (hasCommonParties && similarity > 0.6) {
      return 'DEPENDENT';
    }

    if (similarity > 0.7) {
      return 'SIMILAR';
    }

    if (similarity > 0.5) {
      return 'COMPLEMENTARY';
    }

    return 'SIMILAR';
  }

  private findCommonElements(contract1: any, contract2: any): string[] {
    const elements: string[] = [];

    if (contract1.metadata?.contractType === contract2.metadata?.contractType) {
      elements.push(`Contract Type: ${contract1.metadata.contractType}`);
    }

    if (contract1.financial?.currency === contract2.financial?.currency) {
      elements.push(`Currency: ${contract1.financial.currency}`);
    }

    if (contract1.financial?.paymentTerms === contract2.financial?.paymentTerms) {
      elements.push(`Payment Terms: ${contract1.financial.paymentTerms}`);
    }

    const parties1 = contract1.metadata?.parties || [];
    const parties2 = contract2.metadata?.parties || [];
    const commonParties = parties1.filter((p: string) => parties2.includes(p));
    commonParties.forEach((party: string) => {
      elements.push(`Common Party: ${party}`);
    });

    return elements;
  }

  private findDifferences(contract1: any, contract2: any): string[] {
    const differences: string[] = [];

    if (contract1.financial?.totalValue !== contract2.financial?.totalValue) {
      differences.push(`Contract Value: ${contract1.financial?.totalValue || 'N/A'} vs ${contract2.financial?.totalValue || 'N/A'}`);
    }

    if (contract1.risk?.riskLevel !== contract2.risk?.riskLevel) {
      differences.push(`Risk Level: ${contract1.risk?.riskLevel || 'N/A'} vs ${contract2.risk?.riskLevel || 'N/A'}`);
    }

    return differences;
  }

  private identifyRelationshipRisks(contract1: any, contract2: any, relationshipType: string): string[] {
    const risks: string[] = [];

    if (relationshipType === 'DEPENDENT') {
      risks.push('Dependency risk: Failure of one contract may impact the other');
    }

    if (relationshipType === 'CONFLICTING') {
      risks.push('Conflict risk: Contracts may have contradictory terms');
    }

    const parties1 = contract1.metadata?.parties || [];
    const parties2 = contract2.metadata?.parties || [];
    const commonParties = parties1.filter((p: string) => parties2.includes(p));
    
    if (commonParties.length > 0) {
      risks.push('Counterparty concentration risk: Multiple contracts with same party');
    }

    return risks;
  }

  private generateRelationshipDescription(type: string, commonElements: string[]): string {
    const descriptions = {
      'SIMILAR': 'Contracts share similar characteristics and terms',
      'DEPENDENT': 'Contracts have dependencies that may affect each other',
      'CONFLICTING': 'Contracts may have conflicting terms or requirements',
      'COMPLEMENTARY': 'Contracts complement each other in business objectives',
      'RENEWAL': 'One contract appears to be a renewal or extension of the other',
      'AMENDMENT': 'One contract appears to amend or modify the other'
    };

    let description = descriptions[type] || 'Contracts have an identified relationship';
    
    if (commonElements.length > 0) {
      description += `. Common elements: ${commonElements.slice(0, 3).join(', ')}`;
    }

    return description;
  }

  private async findSimilarContracts(
    targetContract: any,
    allContracts: any[],
    threshold: number
  ): Promise<any[]> {
    const similar = [targetContract];

    for (const contract of allContracts) {
      if (contract.id === targetContract.id) continue;

      const similarity = this.calculateSimilarity(targetContract, contract);
      if (similarity >= threshold) {
        similar.push(contract);
      }
    }

    return similar;
  }

  private async createCluster(contracts: any[]): Promise<ContractCluster> {
    const contractIds = contracts.map(c => c.id);
    const contractType = contracts[0].metadata?.contractType || 'Unknown';
    
    // Calculate common characteristics
    const commonCharacteristics = this.findClusterCharacteristics(contracts);
    
    // Calculate average value
    const values = contracts
      .map(c => c.financial?.totalValue || 0)
      .filter(v => v > 0);
    const averageValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    // Determine risk level
    const riskScores = contracts.map(c => c.risk?.riskScore || 0);
    const avgRiskScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    const riskLevel = avgRiskScore >= 70 ? 'HIGH' : avgRiskScore >= 40 ? 'MEDIUM' : 'LOW';

    // Calculate compliance score
    const complianceScores = contracts.map(c => c.compliance?.complianceScore || 0);
    const avgComplianceScore = complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length;

    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${contractType} Cluster (${contracts.length} contracts)`,
      contractIds,
      commonCharacteristics,
      averageValue,
      riskLevel,
      complianceScore: avgComplianceScore
    };
  }

  private findClusterCharacteristics(contracts: any[]): string[] {
    const characteristics: string[] = [];

    // Contract type
    const types = [...new Set(contracts.map(c => c.metadata?.contractType).filter(Boolean))];
    if (types.length === 1) {
      characteristics.push(`Contract Type: ${types[0]}`);
    }

    // Common payment terms
    const paymentTerms = [...new Set(contracts.map(c => c.financial?.paymentTerms).filter(Boolean))];
    if (paymentTerms.length === 1) {
      characteristics.push(`Payment Terms: ${paymentTerms[0]}`);
    }

    // Currency
    const currencies = [...new Set(contracts.map(c => c.financial?.currency).filter(Boolean))];
    if (currencies.length === 1) {
      characteristics.push(`Currency: ${currencies[0]}`);
    }

    return characteristics;
  }

  private async analyzePatterns(contracts: any[]): Promise<CrossContractInsight[]> {
    const insights: CrossContractInsight[] = [];

    // Payment terms pattern
    const paymentTermsCount = new Map<string, number>();
    contracts.forEach(c => {
      const terms = c.financial?.paymentTerms;
      if (terms) {
        paymentTermsCount.set(terms, (paymentTermsCount.get(terms) || 0) + 1);
      }
    });

    const mostCommonTerms = Array.from(paymentTermsCount.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCommonTerms && mostCommonTerms[1] > contracts.length * 0.7) {
      insights.push({
        type: 'PATTERN',
        title: 'Consistent Payment Terms',
        description: `${mostCommonTerms[1]} out of ${contracts.length} contracts use ${mostCommonTerms[0]} payment terms`,
        affectedContracts: contracts
          .filter(c => c.financial?.paymentTerms === mostCommonTerms[0])
          .map(c => c.id),
        severity: 'LOW',
        recommendation: 'Consider standardizing payment terms across all contracts',
        potentialImpact: 'Improved cash flow management and reduced administrative overhead'
      });
    }

    return insights;
  }

  private async detectAnomalies(contracts: any[]): Promise<CrossContractInsight[]> {
    const insights: CrossContractInsight[] = [];

    // Value anomalies
    const values = contracts.map(c => c.financial?.totalValue || 0).filter(v => v > 0);
    if (values.length > 2) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
      
      const anomalousContracts = contracts.filter(c => {
        const value = c.financial?.totalValue || 0;
        return Math.abs(value - mean) > 2 * stdDev;
      });

      if (anomalousContracts.length > 0) {
        insights.push({
          type: 'ANOMALY',
          title: 'Unusual Contract Values',
          description: `${anomalousContracts.length} contracts have values significantly different from the average`,
          affectedContracts: anomalousContracts.map(c => c.id),
          severity: 'MEDIUM',
          recommendation: 'Review contracts with unusual values for accuracy and appropriateness',
          potentialImpact: 'Potential pricing inconsistencies or data entry errors'
        });
      }
    }

    return insights;
  }

  private async identifyOpportunities(contracts: any[]): Promise<CrossContractInsight[]> {
    const insights: CrossContractInsight[] = [];

    // Volume discount opportunity
    const partyContracts = new Map<string, any[]>();
    contracts.forEach(contract => {
      const parties = contract.metadata?.parties || [];
      parties.forEach((party: string) => {
        if (!partyContracts.has(party)) {
          partyContracts.set(party, []);
        }
        partyContracts.get(party)!.push(contract);
      });
    });

    for (const [party, partyContractList] of partyContracts.entries()) {
      if (partyContractList.length > 2) {
        const totalValue = partyContractList.reduce((sum, c) => sum + (c.financial?.totalValue || 0), 0);
        
        insights.push({
          type: 'OPPORTUNITY',
          title: 'Volume Discount Opportunity',
          description: `${partyContractList.length} contracts with ${party} totaling $${totalValue.toLocaleString()}`,
          affectedContracts: partyContractList.map(c => c.id),
          severity: 'MEDIUM',
          recommendation: 'Consider negotiating volume discounts or consolidated agreements',
          potentialImpact: 'Potential cost savings of 5-15% through volume pricing'
        });
      }
    }

    return insights;
  }

  private async assessCrossContractRisks(contracts: any[]): Promise<CrossContractInsight[]> {
    const insights: CrossContractInsight[] = [];

    // Counterparty concentration risk
    const partyExposure = new Map<string, { contracts: any[], totalValue: number }>();
    
    contracts.forEach(contract => {
      const parties = contract.metadata?.parties || [];
      const value = contract.financial?.totalValue || 0;
      
      parties.forEach((party: string) => {
        if (!partyExposure.has(party)) {
          partyExposure.set(party, { contracts: [], totalValue: 0 });
        }
        const exposure = partyExposure.get(party)!;
        exposure.contracts.push(contract);
        exposure.totalValue += value;
      });
    });

    const totalPortfolioValue = contracts.reduce((sum, c) => sum + (c.financial?.totalValue || 0), 0);

    for (const [party, exposure] of partyExposure.entries()) {
      const concentrationRatio = exposure.totalValue / totalPortfolioValue;
      
      if (concentrationRatio > 0.3) { // More than 30% exposure to single party
        insights.push({
          type: 'RISK',
          title: 'Counterparty Concentration Risk',
          description: `${(concentrationRatio * 100).toFixed(1)}% of contract value concentrated with ${party}`,
          affectedContracts: exposure.contracts.map(c => c.id),
          severity: concentrationRatio > 0.5 ? 'HIGH' : 'MEDIUM',
          recommendation: 'Consider diversifying counterparty exposure to reduce concentration risk',
          potentialImpact: 'High financial impact if counterparty defaults or relationship deteriorates'
        });
      }
    }

    return insights;
  }

  private groupContractsByType(contracts: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    contracts.forEach(contract => {
      const type = contract.metadata?.contractType || 'Unknown';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(contract);
    });

    return groups;
  }

  private async calculateBenchmark(contractType: string, contracts: any[]): Promise<BenchmarkData> {
    const values = contracts.map(c => c.financial?.totalValue || 0).filter(v => v > 0);
    const averageValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    // Calculate average term length (simplified)
    const averageTermLength = 12; // months - would be calculated from actual contract data

    // Common payment terms
    const paymentTermsCount = new Map<string, number>();
    contracts.forEach(c => {
      const terms = c.financial?.paymentTerms;
      if (terms) {
        paymentTermsCount.set(terms, (paymentTermsCount.get(terms) || 0) + 1);
      }
    });
    const commonPaymentTerms = Array.from(paymentTermsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([terms]) => terms);

    // Risk distribution
    const riskDistribution: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    contracts.forEach(c => {
      const riskLevel = c.risk?.riskLevel || 'MEDIUM';
      riskDistribution[riskLevel]++;
    });

    // Compliance scores
    const complianceScores = contracts.map(c => c.compliance?.complianceScore || 0);

    return {
      contractType,
      metrics: {
        averageValue,
        averageTermLength,
        commonPaymentTerms,
        riskDistribution,
        complianceScores
      },
      bestPractices: [
        'Include clear termination clauses',
        'Define payment terms explicitly',
        'Add liability limitations',
        'Include force majeure provisions'
      ],
      commonIssues: [
        'Vague performance metrics',
        'Missing dispute resolution clauses',
        'Inadequate intellectual property provisions'
      ]
    };
  }

  private performBenchmarkComparison(contract: any, benchmark: BenchmarkData): any[] {
    const comparisons = [];

    // Value comparison
    const contractValue = contract.financial?.totalValue || 0;
    const benchmarkValue = benchmark.metrics.averageValue;
    const valueVariance = ((contractValue - benchmarkValue) / benchmarkValue) * 100;
    
    comparisons.push({
      metric: 'Contract Value',
      contractValue: `$${contractValue.toLocaleString()}`,
      benchmarkValue: `$${benchmarkValue.toLocaleString()}`,
      variance: valueVariance,
      assessment: Math.abs(valueVariance) < 10 ? 'AVERAGE' : 
                  valueVariance > 0 ? 'ABOVE_AVERAGE' : 'BELOW_AVERAGE'
    });

    // Risk comparison
    const contractRiskScore = contract.risk?.riskScore || 0;
    const avgRiskScore = 50; // Simplified benchmark
    const riskVariance = contractRiskScore - avgRiskScore;
    
    comparisons.push({
      metric: 'Risk Score',
      contractValue: contractRiskScore,
      benchmarkValue: avgRiskScore,
      variance: riskVariance,
      assessment: Math.abs(riskVariance) < 10 ? 'AVERAGE' : 
                  riskVariance > 0 ? 'ABOVE_AVERAGE' : 'BELOW_AVERAGE'
    });

    return comparisons;
  }

  private generateBenchmarkRecommendations(comparisons: any[]): string[] {
    const recommendations: string[] = [];

    comparisons.forEach(comp => {
      if (comp.metric === 'Contract Value' && comp.assessment === 'ABOVE_AVERAGE') {
        recommendations.push('Contract value is above market average - consider negotiating better terms');
      }
      
      if (comp.metric === 'Risk Score' && comp.assessment === 'ABOVE_AVERAGE') {
        recommendations.push('Risk score is higher than benchmark - review and mitigate identified risks');
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Contract terms are generally aligned with market benchmarks');
    }

    return recommendations;
  }
}

// Export singleton instance
export const crossContractAnalysisService = new CrossContractAnalysisService();