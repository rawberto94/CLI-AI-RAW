/**
 * Unit tests for Enhanced Template Intelligence Worker
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { TemplateIntelligenceWorker } from '../template.worker';
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

describe('TemplateIntelligenceWorker', () => {
  let worker: TemplateIntelligenceWorker;
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

    worker = new TemplateIntelligenceWorker();

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
            content: 'This is a professional services agreement between Company A and Company B...'
          }
        }),
        createOrUpdate: vi.fn().mockResolvedValue({})
      }
    };
  });

  describe('Template Detection', () => {
    it('should detect service agreement template with high confidence', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              templates: [{
                type: 'service_agreement',
                confidence: 0.92,
                name: 'Professional Services Agreement Template',
                characteristics: ['scope of work', 'payment terms', 'intellectual property'],
                structuralElements: ['preamble', 'service specifications'],
                complianceIndicators: ['standard legal formatting'],
                riskFactors: ['unlimited liability exposure']
              }]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await worker.process(mockJob);

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].type).toBe('service_agreement');
      expect(result.templates[0].confidence).toBe(0.92);
      expect(result.templates[0].name).toBe('Professional Services Agreement Template');
    });

    it('should detect multiple template types', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              templates: [
                {
                  type: 'service_agreement',
                  confidence: 0.85,
                  name: 'Service Agreement Template'
                },
                {
                  type: 'nda',
                  confidence: 0.75,
                  name: 'Non-Disclosure Agreement Template'
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await worker.process(mockJob);

      expect(result.templates).toHaveLength(2);
      expect(result.templates[0].type).toBe('service_agreement');
      expect(result.templates[1].type).toBe('nda');
    });

    it('should handle AI detection failure with fallback', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await worker.process(mockJob);

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].type).toBe('custom');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Section Analysis', () => {
    it('should analyze template sections with AI', async () => {
      // Mock template detection response
      const templateResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              templates: [{
                type: 'service_agreement',
                confidence: 0.9,
                name: 'Service Agreement Template'
              }]
            })
          }
        }]
      };

      // Mock section analysis response
      const sectionResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              sections: [
                {
                  name: 'Parties',
                  present: true,
                  confidence: 0.95,
                  quality: 'high',
                  completeness: 'complete',
                  content: 'This agreement is between...',
                  gaps: [],
                  recommendations: []
                },
                {
                  name: 'Scope of Work',
                  present: true,
                  confidence: 0.88,
                  quality: 'medium',
                  completeness: 'partial',
                  content: 'The consultant will provide...',
                  gaps: ['Missing deliverable specifications'],
                  recommendations: ['Add detailed deliverable descriptions']
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(templateResponse)
        .mockResolvedValueOnce(sectionResponse)
        .mockResolvedValue({ choices: [{ message: { content: '{"deviations": []}' } }] });

      const result = await worker.process(mockJob);

      expect(result.templates[0].matchedSections).toHaveLength(2);
      expect(result.templates[0].matchedSections[0].name).toBe('Parties');
      expect(result.templates[0].matchedSections[0].present).toBe(true);
      expect(result.templates[0].matchedSections[1].gaps).toContain('Missing deliverable specifications');
    });
  });

  describe('Deviation Analysis', () => {
    it('should identify template deviations with risk assessment', async () => {
      const templateResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              templates: [{
                type: 'service_agreement',
                confidence: 0.9,
                name: 'Service Agreement Template'
              }]
            })
          }
        }]
      };

      const deviationResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              deviations: [
                {
                  section: 'Limitation of Liability',
                  severity: 'high',
                  category: 'missing_clause',
                  description: 'Complete absence of limitation of liability provisions',
                  legalRisk: 'Unlimited liability exposure',
                  businessImpact: 'Potential catastrophic financial exposure',
                  suggestion: 'Add mutual limitation of liability clause',
                  remediation: ['Draft liability limitation clause', 'Include carve-outs'],
                  industryStandard: '99% of professional services agreements include liability limitations',
                  urgency: 'immediate'
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(templateResponse)
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"sections": []}' } }] })
        .mockResolvedValueOnce(deviationResponse)
        .mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

      const result = await worker.process(mockJob);

      expect(result.templates[0].deviations).toHaveLength(1);
      expect(result.templates[0].deviations[0].section).toBe('Limitation of Liability');
      expect(result.templates[0].deviations[0].severity).toBe('high');
      expect(result.templates[0].deviations[0].legalRisk).toBe('Unlimited liability exposure');
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
                  clause: 'Limitation of Liability',
                  currentIssue: 'Missing liability limitations',
                  recommendation: 'Add comprehensive liability cap',
                  impact: 'high',
                  priority: 1,
                  legalRisk: 'Unlimited exposure',
                  businessBenefit: 'Protected financial exposure'
                }
              ],
              structureImprovements: [
                {
                  area: 'Document Organization',
                  currentState: 'Sections not logically ordered',
                  recommendedState: 'Standard contract structure',
                  rationale: 'Improves readability',
                  implementationSteps: ['Reorganize sections', 'Add numbering']
                }
              ],
              industryStandards: [
                {
                  standard: 'Professional Services Standards',
                  currentCompliance: 'partial',
                  gapAnalysis: 'Missing standard IP provisions',
                  recommendedActions: ['Add IP clause'],
                  industryBenchmark: '95% include IP provisions'
                }
              ],
              standardizationRecommendations: [
                {
                  area: 'Template Structure',
                  standardTemplate: 'Professional Services Template v2.1',
                  currentDeviation: 'Non-standard ordering',
                  standardizationBenefit: 'Improved consistency',
                  implementationComplexity: 'medium'
                }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"templates": [{"type": "service_agreement", "confidence": 0.9}]}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"sections": []}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"deviations": []}' } }] })
        .mockResolvedValueOnce(bestPracticesResponse);

      const result = await worker.process(mockJob);

      expect(result.bestPractices.clauseOptimizations).toHaveLength(1);
      expect(result.bestPractices.clauseOptimizations[0].clause).toBe('Limitation of Liability');
      expect(result.bestPractices.clauseOptimizations[0].impact).toBe('high');

      expect(result.bestPractices.structureImprovements).toHaveLength(1);
      expect(result.bestPractices.structureImprovements[0].area).toBe('Document Organization');

      expect(result.bestPractices.standardizationRecommendations).toHaveLength(1);
      expect(result.bestPractices.standardizationRecommendations[0].area).toBe('Template Structure');
    });

    it('should use enhanced defaults when AI fails', async () => {
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"templates": [{"type": "service_agreement", "confidence": 0.9}]}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"sections": []}' } }] })
        .mockResolvedValueOnce({ choices: [{ message: { content: '{"deviations": []}' } }] })
        .mockRejectedValueOnce(new Error('AI Error'));

      const result = await worker.process(mockJob);

      expect(result.bestPractices.clauseOptimizations).toBeDefined();
      expect(result.bestPractices.structureImprovements).toBeDefined();
      expect(result.bestPractices.standardizationRecommendations).toBeDefined();
      expect(result.bestPractices.confidence).toBe(0.7);
      expect(result.bestPractices.expertiseLevel).toBe('standard');
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate enhanced confidence score', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              templates: [{
                type: 'service_agreement',
                confidence: 0.9,
                name: 'Service Agreement Template'
              }]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await worker.process(mockJob);

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
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

    it('should handle empty content with fallback', async () => {
      worker['repositoryManager'].artifacts.findByContractAndType.mockResolvedValue({
        data: { content: '' }
      });

      await expect(worker.process(mockJob)).rejects.toThrow('No content found in ingestion artifact');
    });

    it('should perform fallback analysis when main processing fails', async () => {
      // Make the main processing fail
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      
      // But provide content for fallback
      worker['repositoryManager'].artifacts.findByContractAndType.mockResolvedValue({
        data: { content: 'This is a service agreement with scope of work and payment terms.' }
      });

      const result = await worker.process(mockJob);

      expect(result.templates).toHaveLength(1);
      expect(result.confidence).toBe(0.5); // Lower confidence for fallback
      expect(result.bestPractices).toBeDefined();
    });
  });

  describe('Heuristic Detection', () => {
    it('should detect service agreement patterns', () => {
      const content = 'This agreement includes scope of work and statement of work provisions.';
      const templates = worker['heuristicTemplateDetection'](content);

      expect(templates).toHaveLength(1);
      expect(templates[0].type).toBe('service_agreement');
      expect(templates[0].confidence).toBe(0.7);
    });

    it('should detect NDA patterns', () => {
      const content = 'This non-disclosure agreement covers confidential information between parties.';
      const templates = worker['heuristicTemplateDetection'](content);

      expect(templates).toHaveLength(1);
      expect(templates[0].type).toBe('nda');
      expect(templates[0].confidence).toBe(0.8);
    });

    it('should default to custom template when no patterns match', () => {
      const content = 'This is a unique agreement with special terms.';
      const templates = worker['heuristicTemplateDetection'](content);

      expect(templates).toHaveLength(1);
      expect(templates[0].type).toBe('custom');
      expect(templates[0].confidence).toBe(0.5);
    });
  });

  describe('Risk Assessment Helpers', () => {
    it('should assess risk severity correctly', () => {
      expect(worker['assessRiskSeverity']('unlimited liability exposure')).toBe('high');
      expect(worker['assessRiskSeverity']('significant contract risk')).toBe('medium');
      expect(worker['assessRiskSeverity']('minor formatting issue')).toBe('low');
    });

    it('should generate appropriate risk mitigation', () => {
      const mitigation = worker['generateRiskMitigation']('unlimited liability exposure');
      expect(mitigation).toContain('limitation of liability');
    });

    it('should assess risk impact appropriately', () => {
      const impact = worker['assessRiskImpact']('unlimited liability exposure');
      expect(impact).toContain('financial exposure');
    });
  });
});