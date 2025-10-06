/**
 * Compliance Analysis Worker
 * Checks contracts for regulatory compliance and standards
 */

export interface ComplianceRegulation {
  type: string;
  name: string;
  compliance: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'UNKNOWN';
  requirements: string[];
  findings: string[];
}

export interface ComplianceIssue {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  recommendation: string;
  section?: string;
}

export interface ComplianceResult {
  complianceScore: number;
  complianceLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  regulations: ComplianceRegulation[];
  issues: ComplianceIssue[];
  recommendations: string[];
  error?: string;
}

export class ComplianceWorker {
  async process(contract: any): Promise<ComplianceResult> {
    try {
      const text = contract.content || '';
      
      const regulations = this.analyzeRegulations(text);
      const issues = this.identifyIssues(text);
      const complianceScore = this.calculateComplianceScore(regulations, issues);
      const complianceLevel = this.getComplianceLevel(complianceScore);
      const recommendations = this.generateRecommendations(issues, regulations);

      return {
        complianceScore,
        complianceLevel,
        regulations,
        issues,
        recommendations
      };
    } catch (error) {
      return {
        complianceScore: 0,
        complianceLevel: 'POOR',
        regulations: [],
        issues: [],
        recommendations: [],
        error: error.message
      };
    }
  }

  private analyzeRegulations(text: string): ComplianceRegulation[] {
    const regulations: ComplianceRegulation[] = [];

    // GDPR Analysis
    if (/gdpr|data\s+protection|personal\s+data/i.test(text)) {
      regulations.push({
        type: 'GDPR',
        name: 'General Data Protection Regulation',
        compliance: 'COMPLIANT',
        requirements: [
          'Data processing lawfulness',
          'Data subject rights',
          'Privacy by design',
          'Data breach notification'
        ],
        findings: [
          'GDPR compliance requirements mentioned',
          'Data protection measures specified'
        ]
      });
    }

    // SOX Compliance
    if (/sox|sarbanes.oxley|financial\s+reporting/i.test(text)) {
      regulations.push({
        type: 'SOX',
        name: 'Sarbanes-Oxley Act',
        compliance: 'COMPLIANT',
        requirements: [
          'Financial reporting accuracy',
          'Internal controls',
          'Audit requirements',
          'Executive certification'
        ],
        findings: [
          'Financial reporting controls mentioned'
        ]
      });
    }

    // SOC 2 Compliance
    if (/soc\s*2|security\s+audit|penetration\s+testing/i.test(text)) {
      regulations.push({
        type: 'SOC2',
        name: 'SOC 2 Type II',
        compliance: 'COMPLIANT',
        requirements: [
          'Security controls',
          'Availability monitoring',
          'Processing integrity',
          'Confidentiality measures',
          'Privacy protection'
        ],
        findings: [
          'SOC 2 Type II certification maintained',
          'Regular security audits specified'
        ]
      });
    }

    // ISO 27001
    if (/iso\s*27001|information\s+security\s+management/i.test(text)) {
      regulations.push({
        type: 'ISO27001',
        name: 'ISO 27001',
        compliance: 'COMPLIANT',
        requirements: [
          'Information security management system',
          'Risk assessment procedures',
          'Security controls implementation',
          'Continuous improvement'
        ],
        findings: [
          'Information security management system referenced'
        ]
      });
    }

    // HIPAA (if healthcare related)
    if (/hipaa|health\s+information|protected\s+health/i.test(text)) {
      regulations.push({
        type: 'HIPAA',
        name: 'Health Insurance Portability and Accountability Act',
        compliance: 'PARTIAL',
        requirements: [
          'PHI protection',
          'Administrative safeguards',
          'Physical safeguards',
          'Technical safeguards'
        ],
        findings: [
          'Healthcare data handling mentioned'
        ]
      });
    }

    return regulations;
  }

  private identifyIssues(text: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];

    // Missing force majeure clause
    if (!/force\s+majeure/i.test(text)) {
      issues.push({
        type: 'MISSING_CLAUSE',
        severity: 'MEDIUM',
        description: 'Force majeure clause not found',
        recommendation: 'Add force majeure clause to address unforeseeable circumstances'
      });
    }

    // Missing governing law clause
    if (!/governed\s+by|governing\s+law/i.test(text)) {
      issues.push({
        type: 'MISSING_CLAUSE',
        severity: 'HIGH',
        description: 'Governing law clause not specified',
        recommendation: 'Specify governing law and jurisdiction for dispute resolution'
      });
    }

    // Missing dispute resolution
    if (!/dispute\s+resolution|arbitration|mediation/i.test(text)) {
      issues.push({
        type: 'MISSING_CLAUSE',
        severity: 'MEDIUM',
        description: 'Dispute resolution mechanism not specified',
        recommendation: 'Add dispute resolution clause (arbitration, mediation, or litigation)'
      });
    }

    // Missing entire agreement clause
    if (!/entire\s+agreement|complete\s+agreement/i.test(text)) {
      issues.push({
        type: 'MISSING_CLAUSE',
        severity: 'LOW',
        description: 'Entire agreement clause not found',
        recommendation: 'Add entire agreement clause to prevent external modifications'
      });
    }

    // Unlimited liability concern
    if (/unlimited\s+liability/i.test(text)) {
      issues.push({
        type: 'LIABILITY_CONCERN',
        severity: 'CRITICAL',
        description: 'Unlimited liability exposure identified',
        recommendation: 'Negotiate liability caps to limit financial exposure'
      });
    }

    // Missing indemnification
    if (!/indemnif/i.test(text)) {
      issues.push({
        type: 'MISSING_PROTECTION',
        severity: 'MEDIUM',
        description: 'Indemnification clause not found',
        recommendation: 'Add mutual indemnification clause for third-party claims'
      });
    }

    // Vague termination terms
    if (/termination/i.test(text) && !/\d+\s+days?\s+notice/i.test(text)) {
      issues.push({
        type: 'VAGUE_TERMS',
        severity: 'MEDIUM',
        description: 'Termination notice period not clearly specified',
        recommendation: 'Specify exact notice period required for termination'
      });
    }

    // Missing intellectual property clause
    if (!/intellectual\s+property|ip\s+rights/i.test(text)) {
      issues.push({
        type: 'MISSING_CLAUSE',
        severity: 'HIGH',
        description: 'Intellectual property rights not addressed',
        recommendation: 'Add intellectual property ownership and licensing clauses'
      });
    }

    return issues;
  }

  private calculateComplianceScore(
    regulations: ComplianceRegulation[],
    issues: ComplianceIssue[]
  ): number {
    let score = 100;

    // Deduct points for issues
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'CRITICAL': score -= 25; break;
        case 'HIGH': score -= 15; break;
        case 'MEDIUM': score -= 10; break;
        case 'LOW': score -= 5; break;
      }
    });

    // Add points for regulatory compliance
    regulations.forEach(reg => {
      switch (reg.compliance) {
        case 'COMPLIANT': score += 5; break;
        case 'PARTIAL': score += 2; break;
        case 'NON_COMPLIANT': score -= 10; break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  private getComplianceLevel(score: number): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'FAIR';
    return 'POOR';
  }

  private generateRecommendations(
    issues: ComplianceIssue[],
    regulations: ComplianceRegulation[]
  ): string[] {
    const recommendations: string[] = [];

    // Add issue-specific recommendations
    issues.forEach(issue => {
      recommendations.push(issue.recommendation);
    });

    // Add regulatory recommendations
    regulations.forEach(reg => {
      if (reg.compliance === 'PARTIAL' || reg.compliance === 'NON_COMPLIANT') {
        recommendations.push(`Ensure full compliance with ${reg.name} requirements`);
      }
    });

    // General recommendations
    recommendations.push('Conduct regular compliance reviews and updates');
    recommendations.push('Maintain documentation of all compliance measures');
    recommendations.push('Establish compliance monitoring and reporting procedures');

    // Remove duplicates and return
    return [...new Set(recommendations)];
  }
}