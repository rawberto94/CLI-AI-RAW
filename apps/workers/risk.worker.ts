/**
 * Risk Assessment Worker
 * Analyzes contracts for various risk factors
 */

export interface RiskFactor {
  type: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  impact: string;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: RiskFactor[];
  recommendations: string[];
  error?: string;
}

export class RiskWorker {
  async process(contract: any): Promise<RiskResult> {
    try {
      const text = contract.content || '';
      
      const riskFactors = this.identifyRiskFactors(text);
      const riskScore = this.calculateRiskScore(riskFactors);
      const riskLevel = this.getRiskLevel(riskScore);
      const recommendations = this.generateRecommendations(riskFactors);

      return {
        riskScore,
        riskLevel,
        riskFactors,
        recommendations
      };
    } catch (error) {
      return {
        riskScore: 0,
        riskLevel: 'LOW',
        riskFactors: [],
        recommendations: [],
        error: error.message
      };
    }
  }

  private identifyRiskFactors(text: string): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // High value risk
    if (/\$\s*[5-9]\d{5,}|\$\s*[1-9]\d{6,}/g.test(text)) {
      factors.push({
        type: 'HIGH_VALUE',
        category: 'FINANCIAL',
        severity: 'HIGH',
        description: 'High contract value increases financial exposure',
        impact: 'Significant financial loss if contract fails'
      });
    }

    // Personnel dependency risk
    if (/key\s+personnel|dependency|specific\s+individual/i.test(text)) {
      factors.push({
        type: 'PERSONNEL_DEPENDENCY',
        category: 'OPERATIONAL',
        severity: 'MEDIUM',
        description: 'Contract depends on specific key personnel',
        impact: 'Service disruption if key personnel unavailable'
      });
    }

    // Technology risk
    if (/technology\s+obsolescence|system\s+integration|cybersecurity/i.test(text)) {
      factors.push({
        type: 'TECHNOLOGY_RISK',
        category: 'TECHNICAL',
        severity: 'MEDIUM',
        description: 'Technology-related risks identified',
        impact: 'Potential system failures or security breaches'
      });
    }

    // Regulatory risk
    if (/regulatory\s+changes|compliance|gdpr|data\s+protection/i.test(text)) {
      factors.push({
        type: 'REGULATORY_RISK',
        category: 'COMPLIANCE',
        severity: 'HIGH',
        description: 'Regulatory compliance requirements',
        impact: 'Legal penalties and compliance violations'
      });
    }

    // Liability risk
    if (/unlimited\s+liability|no\s+liability\s+cap/i.test(text)) {
      factors.push({
        type: 'UNLIMITED_LIABILITY',
        category: 'LEGAL',
        severity: 'HIGH',
        description: 'Unlimited liability exposure',
        impact: 'Unlimited financial exposure'
      });
    } else if (/liability.*limited.*total.*contract.*value/i.test(text)) {
      factors.push({
        type: 'LIMITED_LIABILITY',
        category: 'LEGAL',
        severity: 'LOW',
        description: 'Liability appropriately limited',
        impact: 'Controlled financial exposure'
      });
    }

    // Termination risk
    if (/immediate\s+termination|termination\s+for\s+cause/i.test(text)) {
      factors.push({
        type: 'TERMINATION_RISK',
        category: 'CONTRACTUAL',
        severity: 'MEDIUM',
        description: 'Risk of immediate contract termination',
        impact: 'Sudden loss of revenue or services'
      });
    }

    // Performance risk
    if (/99\.9%\s+uptime|service\s+level\s+agreement|sla/i.test(text)) {
      factors.push({
        type: 'PERFORMANCE_RISK',
        category: 'OPERATIONAL',
        severity: 'MEDIUM',
        description: 'Strict performance requirements',
        impact: 'Penalties for not meeting SLA requirements'
      });
    }

    // Default risk factors for demo
    if (factors.length === 0) {
      factors.push({
        type: 'STANDARD_RISK',
        category: 'GENERAL',
        severity: 'LOW',
        description: 'Standard contractual risks',
        impact: 'Normal business risk exposure'
      });
    }

    return factors;
  }

  private calculateRiskScore(factors: RiskFactor[]): number {
    let score = 0;
    
    factors.forEach(factor => {
      switch (factor.severity) {
        case 'HIGH': score += 30; break;
        case 'MEDIUM': score += 20; break;
        case 'LOW': score += 10; break;
      }
    });

    // Add base risk score
    score += 10;

    return Math.min(score, 100);
  }

  private getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private generateRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];

    factors.forEach(factor => {
      switch (factor.type) {
        case 'HIGH_VALUE':
          recommendations.push('Consider additional insurance coverage for high-value contract');
          recommendations.push('Implement enhanced monitoring and governance procedures');
          break;
        case 'PERSONNEL_DEPENDENCY':
          recommendations.push('Develop contingency plans for key personnel unavailability');
          recommendations.push('Cross-train team members to reduce dependency');
          break;
        case 'TECHNOLOGY_RISK':
          recommendations.push('Conduct regular security assessments and penetration testing');
          recommendations.push('Maintain up-to-date disaster recovery procedures');
          break;
        case 'REGULATORY_RISK':
          recommendations.push('Establish regular compliance monitoring and reporting');
          recommendations.push('Stay updated on regulatory changes in relevant jurisdictions');
          break;
        case 'UNLIMITED_LIABILITY':
          recommendations.push('Negotiate liability caps to limit financial exposure');
          recommendations.push('Review insurance coverage for adequate protection');
          break;
        case 'TERMINATION_RISK':
          recommendations.push('Negotiate reasonable notice periods for termination');
          recommendations.push('Include termination fee provisions to protect revenue');
          break;
        case 'PERFORMANCE_RISK':
          recommendations.push('Ensure realistic and achievable performance targets');
          recommendations.push('Implement robust monitoring and alerting systems');
          break;
      }
    });

    // General recommendations
    recommendations.push('Regular contract performance reviews and monitoring');
    recommendations.push('Maintain clear communication channels with all parties');

    return [...new Set(recommendations)]; // Remove duplicates
  }
}