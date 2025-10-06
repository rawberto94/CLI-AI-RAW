/**
 * Unit tests for Enhanced Clauses Intelligence Worker
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ClausesIntelligenceWorker } from '../clauses.worker';
import { OpenAI } from 'openai';

// Mock OpenAI
vi.mock('openai');
const MockedOpenAI = OpenAI as unknown as Mock;

// Mock database modules
vi.mock('clients-db', () => ({
  getDatabaseManager: vi.fn(() => ({})),
  getRepositoryManager: vi.fn(() => ({
    contracts: {
      findById: vi.fn()
    },
    artifacts: {
      findByContractAndType: vi.fn(),
      createOrUpdate: vi.fn()
    }
  }))
}));

describe('ClausesIntelligenceWorker', () => {
  let worker: ClausesIntelligenceWorker;
  let mockOpenAI: any;
  let mockJob: any;

  beforeEach(() => {
    // Setup OpenAI mock
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    MockedOpenAI.mockImplementation(() => mockOpenAI);

    // Setup environment
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';

    worker = new ClausesIntelligenceWorker();

    // Mock job
    mockJob = {
      data: {
        docId: 'test-doc-123',
        tenantId: 'test-tenant'
      },
      updateProgress: vi.fn()
    };

    // Mock repository methods
    worker['repositoryManager'] = {
      contracts: {
        findById: vi.fn().mockResolvedValue({
          id: 'test-doc-123',
          filename: 'test-contract.pdf'
        })
      },
      artifacts: {
        findByContractAndType: vi.fn().mockResolvedValue({
          data: {
            content: `
PROFESSIONAL SERVICES AGREEMENT

1. PAYMENT TERMS
Payment shall be made within thirty (30) days of invoice date.

2. LIMITATION OF LIABILITY
In no event shall either party be liable for any indirect, incidental, or consequential damages.

3. CONFIDENTIALITY
Both parties agree to maintain confidentiality of proprietary information.

4. TERMINATION
Either party may terminate this agreement with thirty (30) days written notice.

5. INTELLECTUAL PROPERTY
All work product shall be owned by the Client.

6. INDEMNIFICATION
Each party shall indemnify the other against third-party claims.
            `
          }
        }),
        createOrUpdate: vi.fn().mockResolvedValue({})
      }
    };
  });

  describe('Clause Extraction', () => {
    it('should extract clauses with comprehensive analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              clauses: [
                {
                  clauseId: 'payment_terms_001',
                  text: 'Payment shall be made within thirty (30) days of invoice date.',
                  category: 'Payment Terms',
                  subcategory: 'Payment Schedule',
                  riskLevel: 'medium',
                  confidence: 0.92,
                  page: 1,
                  section: 'Section 1',
                  legalSignificance: 'high',
                  businessImpact: 'Defines payment obligations and cash flow impact',
                  enforceability: 'strong',
                  clarity: 'clear',
                  completeness: 'complete',
                  identifiedRisks: [
                    {
                      riskType: 'Cash Flow Risk',
                      severity: 'medium',
                      description: 'Extended payment terms may impact cash flow',
                      likelihood: 'medium',
                      impact: 'Delayed revenue recognition',
                      mitigation: 'Consider early payment discounts'
                    }
                  ],
                  mitigationSuggestions: ['Add early payment discount clause'],
                  improvementPriority: 'medium',
                  suggestedRevisions: ['Clarify payment due dates'],
                  industryComparison: 'Standard Net 30 terms'
                },
                {
                  clauseId: 'liability_001',
                  text: 'In no event shall either party be liable for any indirect, incidental, or consequential damages.',
                  category: 'Limitation of Liability',
                  riskLevel: 'high',
                  confidence: 0.88,
                  legalSignificance: 'critical',
                  businessImpact: 'Limits liability exposure',
                  enforceability: 'strong',
                  clarity: 'clear',
                  completeness: 'partial',
                  identifiedRisks: [],
                  mitigationSuggestions: [],
                  improvementPriority: 'low',
                  suggestedRevisions: [],
                  industryComparison: 'Standard liability limitation'
                }
              ]
            })
          }
        }]
      };

      // Mock all AI calls
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(mockResponse) // Clause extraction
        .mockResolvedValue({ choices: [{ message: { content: '{}' } }] }); // Other calls

      const result = await worker.process(mockJob);

      expect(result.clauses).toHaveLength(2);
      expect(result.clauses[0].clauseId).toBe('payment_terms_001');
      expect(result.clauses[0].category).toBe('Payment Terms');
      expect(result.clauses[0].riskLevel).toBe('medium');
      expect(result.clauses[0].identifiedRisks).toHaveLength(1);
      expect(result.clauses[0].identifiedRisks[0].riskType).toBe('Cash Flow Risk');
    });

    it('should handle AI extraction failure with fallback', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await worker.process(mockJob);

      expect(result.clauses.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.5); // Lower confidence for fallback
      expect(result.clauses[0].clauseId).toContain('heuristic');
    });
  });

  describe('Category Analysis', () => {
    it('should analyze clause categories with completeness assessment', async () => {
      const clauseResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              clauses: [
                {
                  clauseId: 'payment_001',
                  category: 'Payment Terms',
                  riskLevel: 'medium',
                  confidence: 0.9
                },
                {
                  clauseId: 'liability_001',
                  category: 'Limitation of Liability',
                  riskLevel: 'high',
                  confidence: 0.85
                }
              ]
            })
          }
        }]
      };

      const categoryResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              categories: [
                {
                  category: 'Payment Terms',
                  description: 'Defines payment obligations and financial terms',
                  clauseCount: 1,
                  riskLevel: 'medium',
                  completeness: 'complete',
                  industryStandard: true,
                  recommendations: ['Add late payment penalties']
                },
                {
                  category: 'Limitation of Liability',
                  description: 'Limits liability exposure for both parties',
                  clauseCount: 1,
                  riskLevel: 'high',
                  completeness: 'partial',
                  industryStandard: true,
                  recommendations: ['Add liability cap amount']
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(clauseResponse)
        .mockResolvedValueOnce(categoryResponse)
        .mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

      const result = await worker.process(mockJob);

      expect(result.clauseCategories).toHaveLength(2);
      expect(result.clauseCategories[0].category).toBe('Payment Terms');
      expect(result.clauseCategories[0].completeness).toBe('complete');
      expect(result.clauseCategories[0].recommendations).toContain('Add late payment penalties');
    });
  });

  describe('Risk Assessment', () => {
    it('should perform comprehensive risk assessment', async () => {
      const clauseResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              clauses: [
                {
                  clauseId: 'liability_001',
                  category: 'Limitation of Liability',
                  riskLevel: 'critical',
                  identifiedRisks: [
                    {
                      riskType: 'Unlimited Liability',
                      severity: 'critical',
                      description: 'No liability cap present',
                      likelihood: 'high',
                      impact: 'Unlimited financial exposure',
                      mitigation: 'Add liability cap clause'
                    }
                  ]
                }
              ]
            })
          }
        }]
      };

      const riskResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              overallRiskLevel: 'high',
              criticalRisks: [
                {
                  riskType: 'Unlimited Liability',
                  severity: 'critical',
                  description: 'No liability limitations present',
                  likelihood: 'high',
                  impact: 'Potential unlimited financial exposure',
                  mitigation: 'Add comprehensive liability limitation clause'
                }
              ],
              risksByCategory: {
                'Liability': [
                  {
                    riskType: 'Unlimited Liability',
                    severity: 'critical',
                    description: 'No liability cap',
                    likelihood: 'high',
                    impact: 'Financial exposure',
                    mitigation: 'Add liability cap'
                  }
                ]
              },
              mitigationPriorities: [
                'Add liability limitation clause immediately',
                'Strengthen indemnification provisions'
              ],
              riskScore: 75
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(clauseResponse)
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"categories": []}' } }] })
        .mockResolvedValueOnce(riskResponse)
        .mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

      const result = await worker.process(mockJob);

      expect(result.riskAssessment.overallRiskLevel).toBe('high');
      expect(result.riskAssessment.criticalRisks).toHaveLength(1);
      expect(result.riskAssessment.criticalRisks[0].riskType).toBe('Unlimited Liability');
      expect(result.riskAssessment.riskScore).toBe(75);
      expect(result.riskAssessment.mitigationPriorities).toContain('Add liability limitation clause immediately');
    });
  });

  describe('Best Practices Generation', () => {
    it('should generate comprehensive best practices recommendations', async () => {
      const bestPracticesResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              clauseOptimizations: [
                {
                  clauseCategory: 'Payment Terms',
                  currentLanguage: 'Payment within 30 days',
                  suggestedImprovement: 'Add early payment discount',
                  benefit: 'Improved cash flow',
                  implementation: 'Add discount clause',
                  priority: 'medium',
                  effort: 'low'
                }
              ],
              riskMitigations: [
                {
                  riskType: 'Unlimited Liability',
                  riskLevel: 'critical',
                  currentExposure: 'No liability limitations',
                  mitigationStrategy: 'Add liability cap',
                  recommendedClauseAddition: 'Liability shall not exceed contract value',
                  legalRationale: 'Limits financial exposure'
                }
              ],
              clauseAdditions: [
                {
                  recommendedClause: 'Force Majeure',
                  category: 'Risk Management',
                  rationale: 'Protects against unforeseeable circumstances',
                  priority: 'high',
                  riskMitigation: 'Reduces liability for events beyond control',
                  industryStandard: true,
                  suggestedLanguage: 'Neither party shall be liable for delays due to force majeure events'
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"clauses": []}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"categories": []}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"overallRiskLevel": "medium", "criticalRisks": [], "risksByCategory": {}, "mitigationPriorities": [], "riskScore": 50}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '[]' } }] }) // Relationships
        .mockResolvedValueOnce(bestPracticesResponse);

      const result = await worker.process(mockJob);

      expect(result.bestPractices.clauseOptimizations).toHaveLength(1);
      expect(result.bestPractices.clauseOptimizations[0].clauseCategory).toBe('Payment Terms');
      expect(result.bestPractices.clauseOptimizations[0].priority).toBe('medium');

      expect(result.bestPractices.riskMitigations).toHaveLength(1);
      expect(result.bestPractices.riskMitigations[0].riskType).toBe('Unlimited Liability');

      expect(result.bestPractices.clauseAdditions).toHaveLength(1);
      expect(result.bestPractices.clauseAdditions[0].recommendedClause).toBe('Force Majeure');
    });
  });

  describe('Clause Relationships', () => {
    it('should identify relationships between clauses', async () => {
      const clauseResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              clauses: [
                {
                  clauseId: 'payment_001',
                  category: 'Payment Terms',
                  riskLevel: 'medium'
                },
                {
                  clauseId: 'scope_001',
                  category: 'Scope of Work',
                  riskLevel: 'low'
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(clauseResponse)
        .mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

      const result = await worker.process(mockJob);

      // The relationship identification should detect that Payment Terms depend on Scope of Work
      const relationships = result.relationshipMap;
      expect(relationships).toBeDefined();
      expect(Array.isArray(relationships)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing contract gracefully', async () => {
      worker['repositoryManager'].contracts.findById.mockResolvedValue(null);

      await expect(worker.process(mockJob)).rejects.toThrow('Contract test-doc-123 not found');
    });

    it('should handle missing ingestion artifact gracefully', async () => {
      worker['repositoryManager'].artifacts.findByContractAndType.mockResolvedValue(null);

      await expect(worker.process(mockJob)).rejects.toThrow('Ingestion artifact for test-doc-123 not found');
    });

    it('should perform fallback analysis when main processing fails', async () => {
      // Make the main processing fail
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await worker.process(mockJob);

      expect(result.clauses.length).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.5); // Lower confidence for fallback
      expect(result.bestPractices).toBeDefined();
    });
  });

  describe('Heuristic Extraction', () => {
    it('should extract clauses using heuristic methods', () => {
      const content = `
1. PAYMENT TERMS
Payment shall be made within 30 days.

2. LIABILITY
Limitation of liability applies.

3. CONFIDENTIALITY
Confidential information must be protected.
      `;

      const clauses = worker['heuristicClauseExtraction'](content);

      expect(clauses.length).toBeGreaterThan(0);
      expect(clauses[0].category).toBe('Payment Terms');
      expect(clauses[1].category).toBe('Limitation of Liability');
      expect(clauses[2].category).toBe('Confidentiality');
    });

    it('should categorize clauses correctly', () => {
      expect(worker['categorizeClause']('Payment terms are net 30 days')).toBe('Payment Terms');
      expect(worker['categorizeClause']('Liability is limited to contract value')).toBe('Limitation of Liability');
      expect(worker['categorizeClause']('Confidential information protection')).toBe('Confidentiality');
      expect(worker['categorizeClause']('Termination with 30 days notice')).toBe('Termination');
      expect(worker['categorizeClause']('Intellectual property rights')).toBe('Intellectual Property');
      expect(worker['categorizeClause']('General contract provision')).toBe('General');
    });
  });

  describe('Risk Calculation', () => {
    it('should calculate category risk correctly', () => {
      const highRiskClauses = [
        { riskLevel: 'high' as const, clauseId: '1', text: '', category: '', confidence: 0.8 },
        { riskLevel: 'medium' as const, clauseId: '2', text: '', category: '', confidence: 0.8 }
      ] as any[];

      const criticalRiskClauses = [
        { riskLevel: 'critical' as const, clauseId: '1', text: '', category: '', confidence: 0.8 }
      ] as any[];

      expect(worker['calculateCategoryRisk'](highRiskClauses)).toBe('high');
      expect(worker['calculateCategoryRisk'](criticalRiskClauses)).toBe('critical');
    });

    it('should calculate risk score correctly', () => {
      const clauses = [
        { riskLevel: 'high' as const, clauseId: '1', text: '', category: '', confidence: 0.8 },
        { riskLevel: 'medium' as const, clauseId: '2', text: '', category: '', confidence: 0.8 },
        { riskLevel: 'low' as const, clauseId: '3', text: '', category: '', confidence: 0.8 }
      ] as any[];

      const riskScore = worker['calculateRiskScore'](clauses);
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Normalization Methods', () => {
    it('should normalize risk levels correctly', () => {
      expect(worker['normalizeRiskLevel']('CRITICAL')).toBe('critical');
      expect(worker['normalizeRiskLevel']('HIGH')).toBe('high');
      expect(worker['normalizeRiskLevel']('MEDIUM')).toBe('medium');
      expect(worker['normalizeRiskLevel']('LOW')).toBe('low');
      expect(worker['normalizeRiskLevel']('unknown')).toBe('low');
    });

    it('should normalize enforceability correctly', () => {
      expect(worker['normalizeEnforceability']('strong')).toBe('strong');
      expect(worker['normalizeEnforceability']('weak')).toBe('weak');
      expect(worker['normalizeEnforceability']('questionable')).toBe('questionable');
      expect(worker['normalizeEnforceability']('unknown')).toBe('moderate');
    });

    it('should normalize clarity correctly', () => {
      expect(worker['normalizeClarity']('clear')).toBe('clear');
      expect(worker['normalizeClarity']('ambiguous')).toBe('ambiguous');
      expect(worker['normalizeClarity']('unclear')).toBe('unclear');
      expect(worker['normalizeClarity']('unknown')).toBe('moderate');
    });
  });
});