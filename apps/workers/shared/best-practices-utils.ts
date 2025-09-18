/**
 * Shared Best Practices Utilities
 * Consolidates best practices generation patterns and templates
 */

// Best practices categories
export enum BestPracticesCategory {
  FINANCIAL = 'financial',
  LEGAL = 'legal',
  OPERATIONAL = 'operational',
  STRATEGIC = 'strategic',
  COMPLIANCE = 'compliance',
  RISK_MANAGEMENT = 'risk_management',
  PERFORMANCE = 'performance',
  GOVERNANCE = 'governance'
}

// Best practice structure
export interface BestPractice {
  id: string;
  category: BestPracticesCategory;
  title: string;
  description: string;
  implementation: {
    strategy: string;
    steps: string[];
    timeline: string;
    resources: string[];
    budget?: string;
  };
  benefits: string[];
  risks: string[];
  successMetrics: string[];
  stakeholders: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'simple' | 'moderate' | 'complex';
  industrySpecific?: string[];
}

// Best practices collection
export interface BestPracticesCollection {
  category: string;
  practices: BestPractice[];
  overallRecommendation: string;
  implementationPriority: string[];
  totalEstimatedBenefit: string;
  riskMitigation: string[];
}

/**
 * Financial Best Practices Templates
 */
export class FinancialBestPractices {
  
  static getCashFlowManagementPractices(): BestPractice[] {
    return [
      {
        id: 'CFM-001',
        category: BestPracticesCategory.FINANCIAL,
        title: 'Payment Schedule Optimization',
        description: 'Optimize payment timing to align with cash flow cycles and improve working capital management',
        implementation: {
          strategy: 'Negotiate payment terms that align with revenue cycles and cash flow patterns',
          steps: [
            'Analyze current cash flow patterns and payment cycles',
            'Identify optimal payment timing based on revenue cycles',
            'Negotiate revised payment terms with counterparties',
            'Implement automated payment scheduling systems',
            'Monitor and adjust based on performance metrics'
          ],
          timeline: '30-60 days',
          resources: ['Finance team', 'Contract management', 'Treasury operations'],
          budget: '$15,000 - $25,000'
        },
        benefits: [
          'Improved cash flow predictability',
          'Reduced working capital requirements',
          'Lower financing costs',
          'Enhanced liquidity management'
        ],
        risks: [
          'Counterparty resistance to changes',
          'Potential relationship strain',
          'Implementation complexity'
        ],
        successMetrics: [
          'Days payable outstanding (DPO)',
          'Cash conversion cycle',
          'Working capital ratio',
          'Cash flow variance'
        ],
        stakeholders: ['CFO', 'Treasury', 'Procurement', 'Legal'],
        priority: 'high',
        complexity: 'moderate'
      },
      {
        id: 'CFM-002',
        category: BestPracticesCategory.FINANCIAL,
        title: 'Early Payment Discount Programs',
        description: 'Implement strategic early payment discount programs to optimize cash flow and supplier relationships',
        implementation: {
          strategy: 'Offer structured early payment discounts to improve cash flow while maintaining supplier relationships',
          steps: [
            'Analyze supplier payment patterns and cash needs',
            'Calculate optimal discount rates and terms',
            'Develop early payment discount policy',
            'Implement automated discount processing',
            'Monitor program effectiveness and ROI'
          ],
          timeline: '45-90 days',
          resources: ['Finance team', 'Procurement', 'IT support'],
          budget: '$20,000 - $40,000'
        },
        benefits: [
          'Improved supplier relationships',
          'Enhanced cash flow management',
          'Reduced payment processing costs',
          'Better negotiating position'
        ],
        risks: [
          'Reduced profit margins on discounts',
          'Administrative complexity',
          'Potential for abuse'
        ],
        successMetrics: [
          'Early payment adoption rate',
          'Average discount rate achieved',
          'Supplier satisfaction scores',
          'Cash flow improvement'
        ],
        stakeholders: ['CFO', 'Procurement', 'Suppliers', 'Accounts Payable'],
        priority: 'medium',
        complexity: 'moderate'
      }
    ];
  }

  static getCostOptimizationPractices(): BestPractice[] {
    return [
      {
        id: 'CO-001',
        category: BestPracticesCategory.FINANCIAL,
        title: 'Automated Expense Management',
        description: 'Implement automated expense management systems to reduce processing costs and improve accuracy',
        implementation: {
          strategy: 'Deploy comprehensive expense management automation with AI-powered categorization and approval workflows',
          steps: [
            'Evaluate and select expense management platform',
            'Design automated approval workflows',
            'Integrate with existing financial systems',
            'Train users on new processes',
            'Monitor and optimize system performance'
          ],
          timeline: '90-120 days',
          resources: ['Finance team', 'IT department', 'HR', 'External consultants'],
          budget: '$50,000 - $100,000'
        },
        benefits: [
          '15-20% reduction in processing costs',
          'Improved accuracy and compliance',
          'Faster reimbursement cycles',
          'Enhanced visibility and control'
        ],
        risks: [
          'User adoption challenges',
          'Integration complexity',
          'Initial productivity dip'
        ],
        successMetrics: [
          'Processing time reduction',
          'Error rate decrease',
          'User satisfaction scores',
          'Cost per transaction'
        ],
        stakeholders: ['CFO', 'IT Director', 'HR', 'All employees'],
        priority: 'high',
        complexity: 'complex'
      }
    ];
  }

  static getRiskMitigationPractices(): BestPractice[] {
    return [
      {
        id: 'RM-001',
        category: BestPracticesCategory.FINANCIAL,
        title: 'Payment Default Risk Management',
        description: 'Implement comprehensive payment default risk assessment and mitigation strategies',
        implementation: {
          strategy: 'Establish multi-layered payment default risk management with proactive monitoring and mitigation',
          steps: [
            'Implement credit scoring and monitoring systems',
            'Establish payment guarantee requirements',
            'Create early warning indicator dashboards',
            'Develop escalation and collection procedures',
            'Implement payment insurance where appropriate'
          ],
          timeline: '60-90 days',
          resources: ['Finance team', 'Legal', 'Credit analysts', 'Collections'],
          budget: '$30,000 - $60,000'
        },
        benefits: [
          'Reduced payment default rates',
          'Improved cash flow predictability',
          'Enhanced counterparty relationships',
          'Lower bad debt provisions'
        ],
        risks: [
          'Increased administrative burden',
          'Potential relationship strain',
          'False positive alerts'
        ],
        successMetrics: [
          'Payment default rate',
          'Days sales outstanding (DSO)',
          'Bad debt as % of revenue',
          'Collection effectiveness'
        ],
        stakeholders: ['CFO', 'Credit Manager', 'Legal', 'Sales'],
        priority: 'high',
        complexity: 'moderate'
      }
    ];
  }
}

/**
 * Legal Best Practices Templates
 */
export class LegalBestPractices {
  
  static getContractManagementPractices(): BestPractice[] {
    return [
      {
        id: 'CM-001',
        category: BestPracticesCategory.LEGAL,
        title: 'Centralized Contract Repository',
        description: 'Establish a centralized, searchable contract repository with automated alerts and reporting',
        implementation: {
          strategy: 'Deploy enterprise contract management system with AI-powered search and automated lifecycle management',
          steps: [
            'Evaluate and select contract management platform',
            'Migrate existing contracts to centralized system',
            'Implement automated alert and reporting systems',
            'Train users on new processes and workflows',
            'Establish governance and maintenance procedures'
          ],
          timeline: '120-180 days',
          resources: ['Legal team', 'IT department', 'Contract administrators', 'External consultants'],
          budget: '$100,000 - $200,000'
        },
        benefits: [
          'Improved contract visibility and control',
          'Reduced contract leakage and missed renewals',
          'Enhanced compliance monitoring',
          'Faster contract search and retrieval'
        ],
        risks: [
          'Data migration challenges',
          'User adoption resistance',
          'Integration complexity'
        ],
        successMetrics: [
          'Contract search time reduction',
          'Missed renewal rate',
          'Compliance audit scores',
          'User adoption rate'
        ],
        stakeholders: ['General Counsel', 'Legal team', 'Business units', 'IT'],
        priority: 'high',
        complexity: 'complex'
      }
    ];
  }

  static getRiskMitigationPractices(): BestPractice[] {
    return [
      {
        id: 'LRM-001',
        category: BestPracticesCategory.LEGAL,
        title: 'Standardized Risk Assessment Framework',
        description: 'Implement standardized legal risk assessment framework for all contract types',
        implementation: {
          strategy: 'Develop comprehensive risk assessment methodology with automated scoring and escalation',
          steps: [
            'Define risk categories and scoring criteria',
            'Create risk assessment templates and workflows',
            'Implement automated risk scoring systems',
            'Establish escalation and approval procedures',
            'Train legal and business teams on framework'
          ],
          timeline: '90-120 days',
          resources: ['Legal team', 'Risk management', 'Business analysts'],
          budget: '$40,000 - $80,000'
        },
        benefits: [
          'Consistent risk evaluation across contracts',
          'Improved risk visibility and reporting',
          'Enhanced decision-making processes',
          'Reduced legal exposure'
        ],
        risks: [
          'Framework complexity',
          'Subjective risk assessment',
          'Process overhead'
        ],
        successMetrics: [
          'Risk assessment completion rate',
          'Risk prediction accuracy',
          'Legal issue reduction',
          'Decision-making speed'
        ],
        stakeholders: ['General Counsel', 'Risk Manager', 'Business leaders'],
        priority: 'high',
        complexity: 'moderate'
      }
    ];
  }
}

/**
 * Operational Best Practices Templates
 */
export class OperationalBestPractices {
  
  static getProcessOptimizationPractices(): BestPractice[] {
    return [
      {
        id: 'PO-001',
        category: BestPracticesCategory.OPERATIONAL,
        title: 'Automated Workflow Management',
        description: 'Implement automated workflow management for contract processes to improve efficiency and consistency',
        implementation: {
          strategy: 'Deploy workflow automation platform with intelligent routing and approval processes',
          steps: [
            'Map current contract processes and identify automation opportunities',
            'Design automated workflows with approval hierarchies',
            'Implement workflow management platform',
            'Integrate with existing systems and databases',
            'Monitor performance and optimize workflows'
          ],
          timeline: '90-150 days',
          resources: ['Operations team', 'IT department', 'Process analysts', 'Business users'],
          budget: '$60,000 - $120,000'
        },
        benefits: [
          '30-40% reduction in processing time',
          'Improved process consistency',
          'Enhanced visibility and tracking',
          'Reduced manual errors'
        ],
        risks: [
          'Workflow complexity',
          'System integration challenges',
          'Change management resistance'
        ],
        successMetrics: [
          'Process cycle time',
          'Error rate reduction',
          'User satisfaction',
          'Automation adoption rate'
        ],
        stakeholders: ['Operations Manager', 'IT Director', 'Business users'],
        priority: 'high',
        complexity: 'moderate'
      }
    ];
  }
}

/**
 * Best Practices Generator
 */
export class BestPracticesGenerator {
  
  /**
   * Generate best practices for specific category
   */
  static generateForCategory(
    category: BestPracticesCategory,
    context: any = {}
  ): BestPracticesCollection {
    let practices: BestPractice[] = [];
    
    switch (category) {
      case BestPracticesCategory.FINANCIAL:
        practices = [
          ...FinancialBestPractices.getCashFlowManagementPractices(),
          ...FinancialBestPractices.getCostOptimizationPractices(),
          ...FinancialBestPractices.getRiskMitigationPractices()
        ];
        break;
        
      case BestPracticesCategory.LEGAL:
        practices = [
          ...LegalBestPractices.getContractManagementPractices(),
          ...LegalBestPractices.getRiskMitigationPractices()
        ];
        break;
        
      case BestPracticesCategory.OPERATIONAL:
        practices = [
          ...OperationalBestPractices.getProcessOptimizationPractices()
        ];
        break;
        
      default:
        practices = this.getGeneralBestPractices();
    }

    return {
      category: category,
      practices,
      overallRecommendation: this.generateOverallRecommendation(practices),
      implementationPriority: this.prioritizePractices(practices),
      totalEstimatedBenefit: this.calculateTotalBenefit(practices),
      riskMitigation: this.extractRiskMitigation(practices)
    };
  }

  /**
   * Generate contextual best practices based on contract analysis
   */
  static generateContextualPractices(
    analysisResults: any,
    contractType: string = 'general'
  ): BestPracticesCollection {
    const practices: BestPractice[] = [];
    
    // Add financial practices if financial terms detected
    if (analysisResults.financialTerms && analysisResults.financialTerms.length > 0) {
      practices.push(...FinancialBestPractices.getCashFlowManagementPractices());
    }
    
    // Add risk practices if high risks detected
    if (analysisResults.riskLevel === 'high' || analysisResults.riskLevel === 'critical') {
      practices.push(...FinancialBestPractices.getRiskMitigationPractices());
      practices.push(...LegalBestPractices.getRiskMitigationPractices());
    }
    
    // Add operational practices for complex contracts
    if (analysisResults.complexity === 'complex' || analysisResults.complexity === 'highly-complex') {
      practices.push(...OperationalBestPractices.getProcessOptimizationPractices());
    }
    
    // Add legal practices for all contracts
    practices.push(...LegalBestPractices.getContractManagementPractices());

    return {
      category: 'contextual',
      practices,
      overallRecommendation: this.generateContextualRecommendation(analysisResults, contractType),
      implementationPriority: this.prioritizePractices(practices),
      totalEstimatedBenefit: this.calculateTotalBenefit(practices),
      riskMitigation: this.extractRiskMitigation(practices)
    };
  }

  /**
   * Get general best practices
   */
  private static getGeneralBestPractices(): BestPractice[] {
    return [
      {
        id: 'GEN-001',
        category: BestPracticesCategory.GOVERNANCE,
        title: 'Regular Contract Review and Monitoring',
        description: 'Establish regular contract review cycles to ensure ongoing compliance and optimization',
        implementation: {
          strategy: 'Implement systematic contract review process with defined schedules and responsibilities',
          steps: [
            'Define review schedules based on contract types and risk levels',
            'Assign review responsibilities to appropriate stakeholders',
            'Create review checklists and templates',
            'Implement tracking and reporting systems',
            'Establish continuous improvement processes'
          ],
          timeline: '60-90 days',
          resources: ['Legal team', 'Contract managers', 'Business stakeholders']
        },
        benefits: [
          'Improved contract compliance',
          'Early identification of issues',
          'Enhanced relationship management',
          'Optimized contract performance'
        ],
        risks: [
          'Resource intensive',
          'Process overhead',
          'Inconsistent execution'
        ],
        successMetrics: [
          'Review completion rate',
          'Issue identification rate',
          'Compliance scores',
          'Stakeholder satisfaction'
        ],
        stakeholders: ['Legal', 'Business units', 'Management'],
        priority: 'medium',
        complexity: 'simple'
      }
    ];
  }

  /**
   * Generate overall recommendation
   */
  private static generateOverallRecommendation(practices: BestPractice[]): string {
    const highPriorityCount = practices.filter(p => p.priority === 'high' || p.priority === 'critical').length;
    const totalPractices = practices.length;
    
    if (highPriorityCount > totalPractices * 0.6) {
      return 'Immediate action required: Multiple high-priority improvements identified that should be implemented within the next 90 days to optimize contract performance and mitigate risks.';
    } else if (highPriorityCount > 0) {
      return 'Selective implementation recommended: Focus on high-priority practices first, then gradually implement medium-priority improvements over the next 6-12 months.';
    } else {
      return 'Gradual optimization approach: Implement practices based on available resources and strategic priorities over the next 12-18 months.';
    }
  }

  /**
   * Generate contextual recommendation
   */
  private static generateContextualRecommendation(analysisResults: any, contractType: string): string {
    const riskLevel = analysisResults.riskLevel || 'medium';
    const complexity = analysisResults.complexity || 'moderate';
    
    let recommendation = `For this ${contractType} contract with ${riskLevel} risk level and ${complexity} complexity: `;
    
    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendation += 'Prioritize risk mitigation practices immediately. ';
    }
    
    if (complexity === 'complex' || complexity === 'highly-complex') {
      recommendation += 'Implement process optimization and governance practices to manage complexity. ';
    }
    
    recommendation += 'Focus on practices that provide the highest ROI and align with your organization\'s strategic objectives.';
    
    return recommendation;
  }

  /**
   * Prioritize practices based on priority and complexity
   */
  private static prioritizePractices(practices: BestPractice[]): string[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const complexityOrder = { simple: 1, moderate: 2, complex: 3 };
    
    return practices
      .sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return complexityOrder[a.complexity] - complexityOrder[b.complexity];
      })
      .map(p => p.id);
  }

  /**
   * Calculate total estimated benefit
   */
  private static calculateTotalBenefit(practices: BestPractice[]): string {
    const benefitCount = practices.reduce((sum, p) => sum + p.benefits.length, 0);
    const highPriorityCount = practices.filter(p => p.priority === 'high' || p.priority === 'critical').length;
    
    if (highPriorityCount > 3) {
      return 'High - Significant operational and financial improvements expected';
    } else if (benefitCount > 10) {
      return 'Medium-High - Substantial improvements across multiple areas';
    } else {
      return 'Medium - Moderate improvements in key areas';
    }
  }

  /**
   * Extract risk mitigation strategies
   */
  private static extractRiskMitigation(practices: BestPractice[]): string[] {
    const riskMitigation: string[] = [];
    
    practices.forEach(practice => {
      practice.risks.forEach(risk => {
        riskMitigation.push(`${practice.title}: Mitigate ${risk.toLowerCase()}`);
      });
    });
    
    return [...new Set(riskMitigation)];
  }
}

/**
 * Industry-Specific Best Practices
 */
export class IndustryBestPractices {
  
  static getTechnologyBestPractices(): BestPractice[] {
    return [
      {
        id: 'TECH-001',
        category: BestPracticesCategory.LEGAL,
        title: 'Intellectual Property Protection',
        description: 'Implement comprehensive IP protection strategies for technology contracts',
        implementation: {
          strategy: 'Establish robust IP protection framework with clear ownership and licensing terms',
          steps: [
            'Define IP ownership and licensing requirements',
            'Implement IP audit and protection procedures',
            'Establish confidentiality and non-disclosure protocols',
            'Create IP monitoring and enforcement processes'
          ],
          timeline: '90-120 days',
          resources: ['Legal team', 'IP specialists', 'Technology team']
        },
        benefits: [
          'Protected intellectual property assets',
          'Reduced IP litigation risk',
          'Enhanced competitive advantage',
          'Improved licensing opportunities'
        ],
        risks: [
          'Complex IP landscape',
          'Enforcement challenges',
          'International jurisdiction issues'
        ],
        successMetrics: [
          'IP protection coverage',
          'IP dispute rate',
          'Licensing revenue',
          'Competitive position'
        ],
        stakeholders: ['Legal', 'CTO', 'Product teams', 'Business development'],
        priority: 'high',
        complexity: 'complex',
        industrySpecific: ['Technology', 'Software', 'Biotechnology']
      }
    ];
  }

  static getHealthcareBestPractices(): BestPractice[] {
    return [
      {
        id: 'HC-001',
        category: BestPracticesCategory.COMPLIANCE,
        title: 'HIPAA Compliance Framework',
        description: 'Implement comprehensive HIPAA compliance framework for healthcare contracts',
        implementation: {
          strategy: 'Establish end-to-end HIPAA compliance with automated monitoring and reporting',
          steps: [
            'Conduct HIPAA risk assessment',
            'Implement privacy and security controls',
            'Establish breach notification procedures',
            'Create compliance monitoring and reporting systems'
          ],
          timeline: '120-180 days',
          resources: ['Compliance team', 'IT security', 'Legal', 'Healthcare operations']
        },
        benefits: [
          'HIPAA compliance assurance',
          'Reduced regulatory risk',
          'Enhanced patient trust',
          'Improved data security'
        ],
        risks: [
          'Regulatory complexity',
          'High compliance costs',
          'Operational impact'
        ],
        successMetrics: [
          'Compliance audit scores',
          'Breach incident rate',
          'Regulatory penalties',
          'Patient satisfaction'
        ],
        stakeholders: ['Compliance Officer', 'CISO', 'Legal', 'Healthcare providers'],
        priority: 'critical',
        complexity: 'complex',
        industrySpecific: ['Healthcare', 'Medical devices', 'Pharmaceuticals']
      }
    ];
  }
}

// Export all utilities
export {
  BestPracticesGenerator,
  FinancialBestPractices,
  LegalBestPractices,
  OperationalBestPractices,
  IndustryBestPractices
};