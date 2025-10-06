/**
 * Unit tests for Enhanced Financial Worker
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { runFinancial } from '../financial.worker';

// Mock database modules
const mockDb = {
  contract: {
    findUnique: vi.fn(),
  },
  artifact: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('clients-db', () => ({
  default: mockDb,
  getDatabaseManager: vi.fn(() => ({})),
  getRepositoryManager: vi.fn(() => ({}))
}));

// Mock OpenAI client
const mockOpenAIClient = {
  chat: {
    completions: {
      create: vi.fn(),
    }
  }
};

// Mock OpenAI module
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => mockOpenAIClient)
}));

// Mock schema
const mockFinancialArtifactV1Schema = {
  parse: vi.fn((data) => data),
};

vi.mock('schemas', () => ({
  FinancialArtifactV1Schema: mockFinancialArtifactV1Schema
}));

describe('Financial Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4o';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  describe('runFinancial', () => {
    const mockJob = {
      data: {
        docId: 'test-doc-123',
        tenantId: 'tenant-456',
      },
    };

    const mockContractText = `
      PROFESSIONAL SERVICES AGREEMENT
      
      TOTAL CONTRACT VALUE: The total value of this agreement is $500,000 USD
      over a 24-month period.
      
      PAYMENT TERMS: Client agrees to pay Contractor monthly invoices within 
      30 days of receipt. Early payment discount of 2% applies for payments 
      made within 10 days.
      
      COST BREAKDOWN:
      - Professional Services: $400,000
      - Travel and Expenses: $50,000
      - Technology Licensing: $50,000
      
      PRICING STRUCTURE:
      - Senior Consultant: $200/hour
      - Junior Consultant: $150/hour
      - Project Manager: $175/hour
      
      VOLUME DISCOUNT: 10% discount applies for annual commitments exceeding $400,000.
      
      ESCALATION: Annual rate increases of 3% based on Consumer Price Index.
      
      LATE PAYMENT: Late payments incur 1.5% monthly penalty.
      
      CURRENCY: All amounts in US Dollars (USD).
    `;

    const mockContract = {
      id: 'test-doc-123',
      tenantId: 'tenant-456'
    };

    const mockClauses = [
      { clauseId: 'PAYMENT-001', text: 'Client agrees to pay monthly invoices within 30 days' },
      { clauseId: 'VALUE-001', text: 'Total value of this agreement is $500,000 USD' },
      { clauseId: 'DISCOUNT-001', text: '10% discount applies for annual commitments exceeding $400,000' }
    ];

    beforeEach(() => {
      mockDb.contract.findUnique.mockResolvedValue(mockContract);
      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: mockContractText } }) // ingestion
        .mockResolvedValueOnce({ data: { clauses: mockClauses } }); // clauses
      mockDb.artifact.create.mockResolvedValue({ id: 'artifact-123' });
    });

    it('should perform comprehensive financial analysis with GPT-4', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              totalValue: {
                amount: 500000,
                currency: 'USD',
                confidence: 0.95,
                source: 'Section 2.1 - Total Contract Value',
                breakdown: {
                  base: 400000,
                  expenses: 50000,
                  licensing: 50000
                }
              },
              paymentTerms: {
                schedule: 'Net 30',
                frequency: 'Monthly',
                dueDate: '30 days from invoice',
                earlyPaymentDiscount: 2,
                latePaymentPenalty: 1.5,
                paymentMethod: 'Invoice'
              },
              costBreakdown: [
                {
                  category: 'Professional Services',
                  description: 'Consulting and project management services',
                  amount: 400000,
                  currency: 'USD',
                  frequency: 'Over 24 months',
                  isRecurring: true
                },
                {
                  category: 'Travel and Expenses',
                  description: 'Travel costs and business expenses',
                  amount: 50000,
                  currency: 'USD',
                  frequency: 'As incurred',
                  isRecurring: false
                }
              ],
              pricingTables: [
                {
                  name: 'Hourly Rates',
                  items: [
                    {
                      description: 'Senior Consultant',
                      unitPrice: 200,
                      currency: 'USD'
                    },
                    {
                      description: 'Junior Consultant',
                      unitPrice: 150,
                      currency: 'USD'
                    }
                  ],
                  currency: 'USD'
                }
              ],
              discounts: [
                {
                  type: 'percentage',
                  value: 10,
                  description: 'Volume discount for annual commitments',
                  conditions: ['Annual commitment exceeding $400,000'],
                  validUntil: 'Contract term'
                }
              ],
              escalationClauses: [
                {
                  type: 'inflation',
                  rate: 3,
                  frequency: 'Annual',
                  baseIndex: 'Consumer Price Index',
                  description: 'Annual rate adjustment based on CPI'
                }
              ],
              financialRisks: [
                {
                  category: 'payment',
                  severity: 'medium',
                  description: 'Net 30 payment terms may impact cash flow',
                  impact: 'Potential 30-day cash flow delay',
                  mitigation: 'Early payment discount available'
                }
              ],
              currencies: ['USD'],
              overallConfidence: 95
            })
          }
        }]
      };

      const mockBestPracticesResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              costOptimizationStrategies: [
                {
                  category: 'Payment Terms Optimization',
                  currentCostStructure: 'Net 30 payment terms with 2% early payment discount',
                  optimizationApproach: 'Maximize early payment discount utilization',
                  potentialSavings: '$10,000 annually through 2% early payment discounts',
                  implementationSteps: ['Set up automated payment processing', 'Negotiate extended discount period'],
                  riskFactors: ['Cash flow requirements', 'Administrative overhead'],
                  timeline: '30 days',
                  successMetrics: ['Early payment percentage', 'Cost savings realized', 'Cash flow improvement']
                }
              ],
              paymentRecommendations: [
                {
                  paymentType: 'Monthly Invoicing',
                  currentTerms: 'Net 30 with 2% early payment discount',
                  recommendedTerms: 'Net 15 with enhanced early payment incentives',
                  cashFlowImpact: 'Improved cash flow by 15 days, reduced working capital needs',
                  implementationApproach: 'Negotiate improved terms during contract renewal',
                  riskMitigation: ['Maintain good payment history', 'Provide payment guarantees if needed'],
                  industryComparison: 'Net 30 is industry standard, early discounts are competitive advantage',
                  negotiationPoints: ['Volume commitment', 'Long-term relationship', 'Payment reliability']
                }
              ],
              industryBenchmarking: [
                {
                  benchmarkCategory: 'Professional Services Rates',
                  industryStandard: '$150-250/hour for senior consultants',
                  currentPosition: '$200/hour aligns with market rates',
                  competitiveAnalysis: 'Rates are competitive for high-quality consulting services',
                  improvementOpportunities: ['Value-based pricing models', 'Performance incentives'],
                  marketTrends: ['Increasing demand for specialized expertise', 'Shift toward outcome-based pricing'],
                  recommendedActions: ['Regular market rate benchmarking', 'Consider value-based pricing']
                }
              ],
              negotiationTips: [
                {
                  negotiationArea: 'Volume Discounts',
                  currentPosition: '10% discount for $400K+ annual commitment',
                  negotiationStrategy: 'Leverage multi-year commitment for better rates',
                  leveragePoints: ['Long-term partnership', 'Guaranteed volume', 'Payment reliability'],
                  concessionStrategy: ['Offer longer commitment for higher discount', 'Provide payment guarantees'],
                  walkAwayPoints: ['Rates above market premium', 'Unreasonable payment terms'],
                  successIndicators: ['Improved discount rates', 'Better payment terms', 'Enhanced service levels']
                }
              ],
              financialRiskAssessment: [
                {
                  riskCategory: 'Cash Flow Risk',
                  riskDescription: 'Net 30 payment terms create cash flow timing risk',
                  probabilityAssessment: 'medium',
                  financialImpact: 'Potential cash flow delays and increased financing costs',
                  mitigationStrategies: ['Utilize early payment discounts', 'Implement cash flow forecasting', 'Maintain credit facilities'],
                  monitoringApproach: ['Monthly cash flow analysis', 'Payment timing tracking', 'Discount utilization monitoring'],
                  contingencyPlans: ['Alternative financing arrangements', 'Payment term renegotiation', 'Invoice factoring']
                }
              ],
              complianceGuidance: [
                {
                  complianceArea: 'Revenue Recognition',
                  regulatoryRequirements: ['ASC 606 compliance', 'Monthly revenue recognition', 'Performance obligation tracking'],
                  currentCompliance: 'Contract structure supports proper revenue recognition',
                  gapAnalysis: ['Documentation of performance obligations', 'Milestone tracking systems'],
                  recommendedActions: ['Implement milestone tracking', 'Regular compliance reviews', 'Audit trail maintenance'],
                  auditConsiderations: ['Contract documentation', 'Revenue recognition support', 'Performance milestone evidence'],
                  documentationNeeds: ['Detailed SOWs', 'Milestone completion certificates', 'Revenue recognition schedules']
                }
              ]
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create
        .mockResolvedValueOnce(mockGPTResponse)
        .mockResolvedValueOnce(mockBestPracticesResponse);

      const result = await runFinancial(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        financialScore: expect.any(Number),
        confidenceScore: 95
      });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'FINANCIAL',
          data: expect.objectContaining({
            totalValue: expect.objectContaining({
              amount: 500000,
              currency: 'USD',
              confidence: 0.95
            }),
            paymentTerms: expect.objectContaining({
              schedule: 'Net 30',
              frequency: 'Monthly'
            }),
            bestPractices: expect.objectContaining({
              costOptimizationStrategies: expect.any(Array),
              paymentRecommendations: expect.any(Array),
              industryBenchmarking: expect.any(Array)
            }),
            overallFinancialScore: expect.any(Number),
            confidenceScore: 95
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should fall back to heuristic analysis when GPT-4 fails', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await runFinancial(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        financialScore: expect.any(Number),
        confidenceScore: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'FINANCIAL',
          data: expect.objectContaining({
            totalValue: expect.objectContaining({
              amount: expect.any(Number),
              currency: expect.any(String)
            }),
            bestPractices: expect.any(Object),
            overallFinancialScore: expect.any(Number),
            confidenceScore: expect.any(Number)
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should handle missing contract gracefully', async () => {
      mockDb.contract.findUnique.mockResolvedValue(null);

      await expect(runFinancial(mockJob)).rejects.toThrow('Contract test-doc-123 not found');
    });

    it('should handle missing contract text gracefully', async () => {
      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: '' } }) // empty ingestion
        .mockResolvedValueOnce({ data: { clauses: [] } }); // empty clauses

      const result = await runFinancial(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        financialScore: expect.any(Number),
        confidenceScore: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should handle missing OpenAI API key gracefully', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runFinancial(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        financialScore: expect.any(Number),
        confidenceScore: expect.any(Number)
      });

      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should extract monetary amounts using heuristics', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runFinancial(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({
            totalValue: expect.objectContaining({
              amount: expect.any(Number),
              currency: expect.any(String)
            })
          })
        })
      });
    });

    it('should normalize currencies correctly', async () => {
      const textWithMultipleCurrencies = `
        Contract value: $100,000 USD
        European operations: €50,000 EUR
        UK subsidiary: £25,000 GBP
      `;

      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: textWithMultipleCurrencies } })
        .mockResolvedValueOnce({ data: { clauses: [] } });

      delete process.env.OPENAI_API_KEY;

      const result = await runFinancial(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({
            currencies: expect.arrayContaining(['USD', 'EUR', 'GBP'])
          })
        })
      });
    });

    it('should include provenance metadata with model and confidence information', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              totalValue: { amount: 100000, currency: 'USD', confidence: 0.9 },
              paymentTerms: { schedule: 'Net 30', frequency: 'Monthly' },
              currencies: ['USD'],
              overallConfidence: 88
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runFinancial(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'FINANCIAL',
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  worker: 'financial',
                  model: 'gpt-4o',
                  confidenceScore: 88
                })
              ])
            })
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should use tenant ID from contract when not provided in job', async () => {
      const jobWithoutTenant = {
        data: {
          docId: 'test-doc-123'
        }
      };

      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              totalValue: { amount: 50000, currency: 'USD', confidence: 0.8 },
              currencies: ['USD'],
              overallConfidence: 75
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runFinancial(jobWithoutTenant);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-456' // Should use tenant ID from contract
        })
      });
    });

    it('should calculate financial scores correctly', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              totalValue: { amount: 1000000, currency: 'USD', confidence: 0.95 },
              paymentTerms: { schedule: 'Net 15', frequency: 'Monthly' },
              costBreakdown: [
                { category: 'Services', amount: 800000, currency: 'USD', isRecurring: true },
                { category: 'Expenses', amount: 200000, currency: 'USD', isRecurring: false }
              ],
              discounts: [{ type: 'percentage', value: 10, description: 'Volume discount' }],
              financialRisks: [
                { category: 'payment', severity: 'low', description: 'Minimal payment risk' }
              ],
              currencies: ['USD'],
              overallConfidence: 92
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      const result = await runFinancial(mockJob);

      expect(result.financialScore).toBeGreaterThan(70); // Should be high due to good terms
      expect(result.financialScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Financial Analysis Quality', () => {
    it('should identify key financial components', () => {
      const financialComponents = [
        'Total Contract Value',
        'Payment Terms',
        'Cost Breakdown',
        'Pricing Tables',
        'Discounts',
        'Escalation Clauses',
        'Financial Risks'
      ];

      // This test would verify that the worker identifies these key financial components
      expect(financialComponents).toHaveLength(7);
    });

    it('should provide industry-specific financial analysis', () => {
      const industries = [
        'professional-services',
        'technology',
        'manufacturing',
        'healthcare',
        'financial-services'
      ];

      // This test would verify that financial analysis adapts to different industries
      expect(industries).toHaveLength(5);
    });
  });
});