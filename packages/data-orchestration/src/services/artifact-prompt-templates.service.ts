/**
 * Artifact Prompt Templates Service
 * 
 * Provides structured, few-shot prompts for AI artifact generation
 * with examples and detailed instructions for better quality
 */

import { ArtifactType } from './ai-artifact-generator.service';

export interface PromptTemplate {
  systemPrompt: string;
  userPrompt: string;
  examples: PromptExample[];
  outputSchema: any;
  validationRules: string[];
}

export interface PromptExample {
  input: string;
  output: any;
  explanation?: string;
}

export class ArtifactPromptTemplatesService {
  private static instance: ArtifactPromptTemplatesService;

  private constructor() {}

  static getInstance(): ArtifactPromptTemplatesService {
    if (!ArtifactPromptTemplatesService.instance) {
      ArtifactPromptTemplatesService.instance = new ArtifactPromptTemplatesService();
    }
    return ArtifactPromptTemplatesService.instance;
  }

  /**
   * Get enhanced prompt template for artifact type
   */
  getPromptTemplate(artifactType: ArtifactType, context?: any): PromptTemplate {
    switch (artifactType) {
      case 'OVERVIEW':
        return this.getOverviewTemplate(context);
      case 'FINANCIAL':
        return this.getFinancialTemplate(context);
      case 'CLAUSES':
        return this.getClausesTemplate(context);
      case 'RATES':
        return this.getRatesTemplate(context);
      case 'COMPLIANCE':
        return this.getComplianceTemplate(context);
      case 'RISK':
        return this.getRiskTemplate(context);
      default:
        throw new Error(`Unknown artifact type: ${artifactType}`);
    }
  }

  /**
   * Build complete prompt with examples
   */
  buildPrompt(template: PromptTemplate, contractText: string): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const examplesText = template.examples
      .map((ex, idx) => {
        return `
Example ${idx + 1}:
Input: ${ex.input}
Output: ${JSON.stringify(ex.output, null, 2)}
${ex.explanation ? `Explanation: ${ex.explanation}` : ''}
`;
      })
      .join('\n');

    const userPrompt = `${template.userPrompt}

${examplesText}

Now analyze this contract:
${contractText.substring(0, 15000)}

Return ONLY valid JSON matching the schema. Include a "certainty" field (0-1) indicating your confidence.`;

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
    };
  }

  // =========================================================================
  // TEMPLATE DEFINITIONS
  // =========================================================================

  private getOverviewTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are an expert contract analyst specializing in extracting key overview information from legal documents. 
You provide accurate, structured data with high attention to detail. Always include a certainty score.`,
      
      userPrompt: `Extract comprehensive overview information from the contract and return as JSON.`,
      
      examples: [
        {
          input: 'CONSULTING AGREEMENT between Acme Corp (Client) and Tech Solutions LLC (Consultant). Effective Date: January 1, 2024. Term: 12 months.',
          output: {
            summary: 'Consulting agreement for technology services between Acme Corp and Tech Solutions LLC',
            parties: [
              { name: 'Acme Corp', role: 'client', type: 'corporation' },
              { name: 'Tech Solutions LLC', role: 'consultant', type: 'llc' }
            ],
            contractType: 'Consulting Agreement',
            effectiveDate: '2024-01-01',
            expirationDate: '2025-01-01',
            term: '12 months',
            jurisdiction: null,
            keyTerms: ['Technology consulting services', '12-month engagement'],
            certainty: 0.95
          },
          explanation: 'Clear parties, dates, and contract type identified'
        },
        {
          input: 'SERVICE AGREEMENT. This agreement is made on March 15, 2024 between XYZ Inc. and ABC Services.',
          output: {
            summary: 'Service agreement between XYZ Inc. and ABC Services',
            parties: [
              { name: 'XYZ Inc.', role: 'client', type: 'corporation' },
              { name: 'ABC Services', role: 'service provider', type: 'unknown' }
            ],
            contractType: 'Service Agreement',
            effectiveDate: '2024-03-15',
            expirationDate: null,
            term: null,
            jurisdiction: null,
            keyTerms: [],
            certainty: 0.75
          },
          explanation: 'Basic information present, but missing term and jurisdiction'
        }
      ],
      
      outputSchema: {
        summary: 'string (concise 1-2 sentence overview)',
        parties: 'array of {name: string, role: string, type: string}',
        contractType: 'string',
        effectiveDate: 'string (YYYY-MM-DD) or null',
        expirationDate: 'string (YYYY-MM-DD) or null',
        term: 'string or null',
        jurisdiction: 'string or null',
        keyTerms: 'array of strings',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Must include at least 2 parties',
        'Dates must be in YYYY-MM-DD format',
        'Summary must be 10-200 characters',
        'Certainty must be between 0 and 1'
      ]
    };
  }

  private getFinancialTemplate(context?: any): PromptTemplate {
    const overviewContext = context?.overview ? `
Context from Overview:
- Contract Type: ${context.overview.contractType}
- Parties: ${context.overview.parties?.map((p: any) => p.name).join(', ')}
- Term: ${context.overview.term}
` : '';

    return {
      systemPrompt: `You are a financial analyst expert at extracting monetary information from contracts.
You identify all costs, payment terms, pricing structures, and financial obligations with precision.${overviewContext}`,
      
      userPrompt: `Extract all financial information from the contract and return as JSON.`,
      
      examples: [
        {
          input: 'Total project cost: $150,000. Payment terms: Net 30. Monthly retainer: $12,500. 10% discount for early payment.',
          output: {
            totalValue: 150000,
            currency: 'USD',
            paymentTerms: ['Net 30 days', 'Monthly payments'],
            paymentSchedule: [
              { description: 'Monthly retainer', amount: 12500, frequency: 'monthly' }
            ],
            costBreakdown: [
              { category: 'Total Project Cost', amount: 150000, description: 'Full project value' },
              { category: 'Monthly Retainer', amount: 12500, description: 'Recurring monthly fee' }
            ],
            discounts: [
              { type: 'early_payment', value: 10, unit: 'percentage', description: '10% discount for early payment' }
            ],
            penalties: [],
            certainty: 0.92
          }
        }
      ],
      
      outputSchema: {
        totalValue: 'number or null',
        currency: 'string (ISO code)',
        paymentTerms: 'array of strings',
        paymentSchedule: 'array of {description, amount, frequency, dueDate?}',
        costBreakdown: 'array of {category, amount, description}',
        discounts: 'array of {type, value, unit, description}',
        penalties: 'array of {type, amount, description, trigger}',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'All amounts must be positive numbers',
        'Currency must be valid ISO code',
        'Payment terms must be specific',
        'Cost breakdown should sum to totalValue if possible'
      ]
    };
  }

  private getClausesTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are a legal expert specializing in contract clause analysis.
You identify, categorize, and assess the risk level of contract clauses with high accuracy.`,
      
      userPrompt: `Extract and analyze all significant clauses from the contract.`,
      
      examples: [
        {
          input: 'TERMINATION: Either party may terminate this agreement with 30 days written notice. CONFIDENTIALITY: All proprietary information must remain confidential for 2 years post-termination.',
          output: {
            clauses: [
              {
                id: 'clause-1',
                type: 'Termination',
                title: 'Termination Rights',
                content: 'Either party may terminate this agreement with 30 days written notice.',
                riskLevel: 'low',
                importance: 'high',
                obligations: ['Provide 30 days written notice'],
                beneficiary: 'both',
                concerns: []
              },
              {
                id: 'clause-2',
                type: 'Confidentiality',
                title: 'Confidentiality Obligations',
                content: 'All proprietary information must remain confidential for 2 years post-termination.',
                riskLevel: 'medium',
                importance: 'high',
                obligations: ['Maintain confidentiality for 2 years after termination'],
                beneficiary: 'both',
                concerns: ['Extended post-termination obligations']
              }
            ],
            certainty: 0.88
          }
        }
      ],
      
      outputSchema: {
        clauses: 'array of {id, type, title, content, riskLevel, importance, obligations, beneficiary, concerns}',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Each clause must have unique id',
        'Risk level must be: low, medium, or high',
        'Importance must be: low, medium, or high',
        'Content must be non-empty'
      ]
    };
  }

  private getRatesTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are an expert at extracting rate card information from professional services contracts.
You identify hourly rates, daily rates, role-based pricing, and location-based variations.`,
      
      userPrompt: `Extract all rate card and pricing information from the contract.`,
      
      examples: [
        {
          input: 'Senior Developer: $175/hour. Junior Developer: $125/hour. Rates apply to US locations. Offshore rates: 30% discount.',
          output: {
            rateCards: [
              {
                role: 'Senior Developer',
                level: 'Senior',
                rate: 175,
                unit: 'hour',
                currency: 'USD',
                location: 'US',
                effectiveDate: null,
                notes: null
              },
              {
                role: 'Junior Developer',
                level: 'Junior',
                rate: 125,
                unit: 'hour',
                currency: 'USD',
                location: 'US',
                effectiveDate: null,
                notes: null
              },
              {
                role: 'Senior Developer',
                level: 'Senior',
                rate: 122.50,
                unit: 'hour',
                currency: 'USD',
                location: 'Offshore',
                effectiveDate: null,
                notes: '30% discount applied'
              },
              {
                role: 'Junior Developer',
                level: 'Junior',
                rate: 87.50,
                unit: 'hour',
                currency: 'USD',
                location: 'Offshore',
                effectiveDate: null,
                notes: '30% discount applied'
              }
            ],
            roles: ['Senior Developer', 'Junior Developer'],
            locations: ['US', 'Offshore'],
            rateModifiers: [
              { type: 'location', condition: 'Offshore', adjustment: -30, unit: 'percentage' }
            ],
            certainty: 0.90
          }
        }
      ],
      
      outputSchema: {
        rateCards: 'array of {role, level, rate, unit, currency, location, effectiveDate, notes}',
        roles: 'array of strings',
        locations: 'array of strings',
        rateModifiers: 'array of {type, condition, adjustment, unit}',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Rates must be positive numbers',
        'Unit must be: hour, day, week, month, or year',
        'Currency must be valid ISO code',
        'Each rate card must have role and rate'
      ]
    };
  }

  private getComplianceTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are a compliance expert specializing in identifying regulatory requirements and certifications in contracts.
You recognize GDPR, HIPAA, SOC 2, ISO standards, and other compliance frameworks.`,
      
      userPrompt: `Extract all compliance and regulatory information from the contract.`,
      
      examples: [
        {
          input: 'Vendor must maintain SOC 2 Type II certification. All data processing must comply with GDPR. Annual security audits required.',
          output: {
            regulations: ['GDPR'],
            certifications: ['SOC 2 Type II'],
            complianceRequirements: [
              {
                requirement: 'Maintain SOC 2 Type II certification',
                category: 'Security',
                mandatory: true,
                frequency: 'ongoing',
                responsibility: 'vendor'
              },
              {
                requirement: 'GDPR compliance for all data processing',
                category: 'Data Privacy',
                mandatory: true,
                frequency: 'ongoing',
                responsibility: 'vendor'
              },
              {
                requirement: 'Annual security audits',
                category: 'Security',
                mandatory: true,
                frequency: 'annual',
                responsibility: 'vendor'
              }
            ],
            auditRights: ['Annual security audits'],
            dataProtection: ['GDPR compliance'],
            certainty: 0.93
          }
        }
      ],
      
      outputSchema: {
        regulations: 'array of strings',
        certifications: 'array of strings',
        complianceRequirements: 'array of {requirement, category, mandatory, frequency, responsibility}',
        auditRights: 'array of strings',
        dataProtection: 'array of strings',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Regulations must be recognized standards',
        'Certifications must be industry-standard',
        'Requirements must specify responsibility',
        'Frequency must be: ongoing, annual, quarterly, monthly, or one-time'
      ]
    };
  }

  private getRiskTemplate(context?: any): PromptTemplate {
    const financialContext = context?.financial ? `
Financial Context:
- Total Value: ${context.financial.currency} ${context.financial.totalValue}
- Payment Terms: ${context.financial.paymentTerms?.join(', ')}
` : '';

    const clausesContext = context?.clauses ? `
Key Clauses Identified: ${context.clauses.clauses?.length || 0} clauses analyzed
` : '';

    return {
      systemPrompt: `You are a risk assessment expert specializing in indirect procurement contract analysis.
You identify financial, legal, operational, and reputational risks with detailed recommendations.
Focus on cost savings opportunities and optimization potential in indirect procurement.${financialContext}${clausesContext}`,
      
      userPrompt: `Analyze all risks in the contract and provide a comprehensive risk assessment with focus on cost savings opportunities.`,
      
      examples: [
        {
          input: 'Unlimited liability for data breaches. Termination without cause with 7 days notice. No cap on penalties.',
          output: {
            overallScore: 85,
            riskLevel: 'high',
            riskFactors: [
              {
                category: 'Legal',
                severity: 'high',
                description: 'Unlimited liability for data breaches',
                impact: 'Could result in catastrophic financial loss',
                likelihood: 'medium',
                mitigation: 'Negotiate liability cap'
              },
              {
                category: 'Operational',
                severity: 'high',
                description: 'Termination without cause with only 7 days notice',
                impact: 'Insufficient time to transition or find alternatives',
                likelihood: 'low',
                mitigation: 'Request 30-60 days notice period'
              },
              {
                category: 'Financial',
                severity: 'high',
                description: 'No cap on penalties',
                impact: 'Unlimited financial exposure',
                likelihood: 'medium',
                mitigation: 'Negotiate penalty caps'
              }
            ],
            recommendations: [
              'Negotiate liability limitations before signing',
              'Request extended termination notice period',
              'Establish penalty caps',
              'Consider insurance coverage',
              'Require legal review'
            ],
            costSavingsOpportunities: [
              'Negotiate liability cap to reduce insurance costs',
              'Extended notice period allows better supplier transition planning',
              'Penalty caps reduce financial exposure'
            ],
            redFlags: [
              'Unlimited liability exposure',
              'Extremely short termination notice',
              'Uncapped penalties'
            ],
            certainty: 0.91
          }
        }
      ],
      
      outputSchema: {
        overallScore: 'number (0-100, higher = more risk)',
        riskLevel: 'string (low, medium, high, critical)',
        riskFactors: 'array of {category, severity, description, impact, likelihood, mitigation}',
        recommendations: 'array of strings',
        redFlags: 'array of strings',
        costSavingsOpportunities: 'array of strings (indirect procurement cost optimization)',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Overall score must be 0-100',
        'Risk level must match score (0-30: low, 31-60: medium, 61-85: high, 86-100: critical)',
        'Each risk factor must have mitigation',
        'Recommendations must be actionable'
      ]
    };
  }
}

export const artifactPromptTemplatesService = ArtifactPromptTemplatesService.getInstance();
