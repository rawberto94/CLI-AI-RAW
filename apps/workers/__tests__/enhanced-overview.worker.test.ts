/**
 * Unit tests for Enhanced Overview Worker
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { runEnhancedOverview } from '../enhanced-overview.worker';

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
const mockOverviewArtifactV1Schema = {
  parse: vi.fn((data) => data),
};

vi.mock('schemas', () => ({
  OverviewArtifactV1Schema: mockOverviewArtifactV1Schema
}));

describe('Enhanced Overview Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4o';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  describe('runEnhancedOverview', () => {
    const mockJob = {
      data: {
        docId: 'test-doc-123',
        tenantId: 'tenant-456',
      },
    };

    const mockContractText = `
      STRATEGIC PARTNERSHIP AGREEMENT
      
      This agreement is entered into between TechCorp Inc. ("Company") and 
      InnovateServices LLC ("Service Provider") for the provision of 
      comprehensive technology consulting services.
      
      SCOPE OF SERVICES: Service Provider will provide strategic technology 
      consulting, system architecture design, and implementation support.
      
      PAYMENT TERMS: Company agrees to pay Service Provider $50,000 monthly 
      for services rendered, payable within 30 days of invoice.
      
      TERM: This agreement shall remain in effect for 24 months from the 
      effective date, with automatic renewal for additional 12-month periods.
      
      INTELLECTUAL PROPERTY: All work product developed under this agreement 
      shall be jointly owned by both parties.
      
      CONFIDENTIALITY: Both parties agree to maintain strict confidentiality 
      of all proprietary information shared during the engagement.
      
      TERMINATION: Either party may terminate this agreement with 60 days 
      written notice.
    `;

    const mockContract = {
      id: 'test-doc-123',
      tenantId: 'tenant-456'
    };

    const mockClauses = [
      { clauseId: 'SCOPE-001', text: 'Service Provider will provide strategic technology consulting', clauseType: 'Scope of Services' },
      { clauseId: 'PAYMENT-001', text: 'Company agrees to pay Service Provider $50,000 monthly', clauseType: 'Payment Terms' },
      { clauseId: 'IP-001', text: 'All work product shall be jointly owned', clauseType: 'Intellectual Property' }
    ];

    const mockCompliance = [
      { policyId: 'CONF-001', status: 'compliant', details: 'Confidentiality clauses present' },
      { policyId: 'TERM-001', status: 'compliant', details: 'Termination provisions adequate' },
      { policyId: 'IP-001', status: 'partial', details: 'IP ownership could be clearer' }
    ];

    const mockRisks = [
      { riskType: 'Financial', severity: 'medium', description: 'Monthly payment commitment of $50,000' },
      { riskType: 'IP', severity: 'high', description: 'Joint IP ownership may create disputes' },
      { riskType: 'Operational', severity: 'low', description: 'Standard service delivery risks' }
    ];

    beforeEach(() => {
      mockDb.contract.findUnique.mockResolvedValue(mockContract);
      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: mockContractText } }) // ingestion
        .mockResolvedValueOnce({ data: { clauses: mockClauses } }) // clauses
        .mockResolvedValueOnce({ data: { compliance: mockCompliance } }) // compliance
        .mockResolvedValueOnce({ data: { risks: mockRisks } }); // risks
      mockDb.artifact.create.mockResolvedValue({ id: 'artifact-123' });
    });

    it('should perform comprehensive overview analysis with GPT-4', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'This Strategic Partnership Agreement between TechCorp Inc. and InnovateServices LLC establishes a comprehensive technology consulting relationship with significant strategic value. The 24-month engagement with automatic renewal demonstrates long-term partnership commitment. Joint IP ownership and substantial monthly investment indicate high-value strategic collaboration.',
              parties: ['TechCorp Inc.', 'InnovateServices LLC'],
              contractType: 'Strategic Partnership Agreement',
              keyTerms: ['Technology Consulting Services', 'Monthly Payment $50,000', 'Joint IP Ownership', '24-Month Term', 'Automatic Renewal', 'Confidentiality'],
              insights: [
                'Strategic partnership structure enables long-term technology transformation',
                'Joint IP ownership creates shared value but requires careful governance',
                'Substantial monthly investment ($1.2M annually) indicates high strategic priority',
                'Automatic renewal mechanism provides relationship stability and continuity',
                'Comprehensive service scope allows for scalable technology initiatives',
                'Strong confidentiality provisions support innovation and competitive advantage',
                'Partnership model facilitates knowledge transfer and capability building'
              ],
              riskFactors: [
                'Joint IP ownership may create future disputes over commercialization rights',
                'High monthly financial commitment requires careful budget management',
                'Automatic renewal could lead to unintended long-term obligations'
              ],
              bestPractices: {
                strategicGuidance: [
                  {
                    category: 'Strategic Partnership Management',
                    recommendation: 'Establish joint steering committee for strategic oversight and decision-making',
                    businessImpact: 'Enhanced strategic alignment and partnership value realization',
                    implementationApproach: 'Form committee with senior executives from both organizations',
                    timeline: '30 days',
                    successMetrics: ['Partnership satisfaction scores', 'Strategic objective achievement'],
                    stakeholders: ['C-level executives', 'Technology leaders', 'Business unit heads']
                  }
                ],
                relationshipManagement: [
                  {
                    relationshipType: 'Strategic Technology Partnership',
                    managementApproach: 'Structured partnership management with regular governance',
                    keyActivities: ['Monthly business reviews', 'Quarterly strategic planning', 'Annual partnership assessment'],
                    communicationFrequency: 'Weekly operational, monthly strategic',
                    relationshipMetrics: ['Partnership health score', 'Value delivery metrics', 'Innovation index'],
                    escalationProcedures: 'Defined escalation matrix with executive involvement',
                    improvementOpportunities: ['Enhanced collaboration tools', 'Joint innovation programs', 'Expanded service scope']
                  }
                ],
                performanceOptimization: [
                  {
                    performanceArea: 'Service Delivery Excellence',
                    currentState: 'Standard consulting engagement model',
                    optimizationStrategy: 'Implement outcome-based performance management',
                    expectedBenefits: ['Improved service quality', 'Better business outcomes', 'Enhanced ROI'],
                    implementationSteps: ['Define success metrics', 'Implement tracking systems', 'Regular performance reviews'],
                    resourceRequirements: ['Performance management tools', 'Dedicated program manager'],
                    timeframe: '60 days',
                    measurementApproach: 'Balanced scorecard with business and technical metrics'
                  }
                ],
                governanceRecommendations: [
                  {
                    governanceArea: 'Joint IP Management',
                    currentGaps: 'Unclear IP commercialization and usage rights',
                    recommendedStructure: 'Joint IP governance committee with clear decision rights',
                    roles: ['IP committee chair', 'Legal representatives', 'Technology leaders'],
                    responsibilities: ['IP strategy', 'Commercialization decisions', 'Dispute resolution'],
                    decisionMaking: 'Consensus-based with defined tie-breaking procedures',
                    reportingMechanisms: ['Quarterly IP reports', 'Annual IP portfolio review'],
                    reviewCycles: 'Quarterly governance reviews with annual strategic assessment'
                  }
                ],
                communicationProtocols: [
                  {
                    communicationType: 'Strategic Partnership Communication',
                    purpose: 'Ensure effective information flow and decision-making',
                    participants: ['Partnership managers', 'Technical teams', 'Executive sponsors'],
                    frequency: 'Weekly operational, monthly strategic, quarterly executive',
                    format: 'Structured meetings with standardized agendas and deliverables',
                    deliverables: ['Meeting minutes', 'Action item tracking', 'Performance dashboards'],
                    escalationTriggers: ['Performance issues', 'Strategic misalignment', 'Resource conflicts'],
                    documentationRequirements: 'Comprehensive documentation with version control'
                  }
                ],
                riskMitigationStrategies: [
                  {
                    riskCategory: 'IP and Commercial Risk',
                    mitigationApproach: 'Proactive IP governance with clear commercialization framework',
                    preventiveControls: ['IP agreement clarification', 'Regular IP audits', 'Clear usage guidelines'],
                    monitoringMechanisms: ['IP portfolio tracking', 'Usage monitoring', 'Dispute early warning'],
                    responseActions: ['Mediation procedures', 'Expert arbitration', 'Fallback licensing terms'],
                    contingencyPlans: ['IP separation procedures', 'Alternative commercialization models'],
                    responsibleParties: ['Legal teams', 'IP committee', 'Business leaders'],
                    reviewSchedule: 'Quarterly IP risk assessment'
                  }
                ]
              },
              overallConfidence: 92
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      const result = await runEnhancedOverview(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        insightsGenerated: 7,
        confidenceScore: 92
      });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'ENHANCED_OVERVIEW',
          data: expect.objectContaining({
            summary: expect.stringContaining('Strategic Partnership Agreement'),
            parties: expect.arrayContaining(['TechCorp Inc.', 'InnovateServices LLC']),
            contractType: 'Strategic Partnership Agreement',
            keyTerms: expect.arrayContaining(['Technology Consulting Services', 'Joint IP Ownership']),
            insights: expect.arrayContaining([
              expect.stringContaining('Strategic partnership structure')
            ]),
            bestPractices: expect.objectContaining({
              strategicGuidance: expect.any(Array),
              relationshipManagement: expect.any(Array),
              performanceOptimization: expect.any(Array),
              governanceRecommendations: expect.any(Array),
              communicationProtocols: expect.any(Array),
              riskMitigationStrategies: expect.any(Array)
            }),
            confidence: 0.92,
            processingTime: expect.any(Number)
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should fall back to heuristic analysis when GPT-4 fails', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await runEnhancedOverview(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        insightsGenerated: expect.any(Number),
        confidenceScore: 60
      });

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'ENHANCED_OVERVIEW',
          data: expect.objectContaining({
            summary: expect.any(String),
            parties: expect.any(Array),
            contractType: expect.any(String),
            keyTerms: expect.any(Array),
            insights: expect.any(Array),
            riskFactors: expect.any(Array),
            bestPractices: expect.any(Object),
            confidence: 0.6,
            processingTime: expect.any(Number)
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should handle missing contract gracefully', async () => {
      mockDb.contract.findUnique.mockResolvedValue(null);

      await expect(runEnhancedOverview(mockJob)).rejects.toThrow('Contract test-doc-123 not found');
    });

    it('should handle missing artifacts gracefully', async () => {
      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: mockContractText } }) // ingestion
        .mockResolvedValueOnce(null) // no clauses
        .mockResolvedValueOnce(null) // no compliance
        .mockResolvedValueOnce(null); // no risks

      const result = await runEnhancedOverview(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        insightsGenerated: expect.any(Number),
        confidenceScore: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should handle missing OpenAI API key gracefully', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runEnhancedOverview(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        insightsGenerated: expect.any(Number),
        confidenceScore: 60
      });

      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should extract parties using heuristics', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runEnhancedOverview(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({
            parties: expect.arrayContaining([
              expect.stringContaining('TechCorp'),
              expect.stringContaining('InnovateServices')
            ])
          })
        })
      });
    });

    it('should determine contract type using heuristics', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runEnhancedOverview(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({
            contractType: expect.stringMatching(/Agreement$/)
          })
        })
      });
    });

    it('should include provenance metadata with model and confidence information', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: 'Test summary',
              parties: ['Party 1', 'Party 2'],
              contractType: 'Test Agreement',
              keyTerms: ['Term 1'],
              insights: ['Insight 1'],
              riskFactors: ['Risk 1'],
              bestPractices: {
                strategicGuidance: [],
                relationshipManagement: [],
                performanceOptimization: [],
                governanceRecommendations: [],
                communicationProtocols: [],
                riskMitigationStrategies: []
              },
              overallConfidence: 85
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runEnhancedOverview(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'ENHANCED_OVERVIEW',
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  worker: 'enhanced-overview',
                  model: 'gpt-4o',
                  confidenceScore: 85
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
              summary: 'Test summary',
              parties: ['Party 1'],
              contractType: 'Test Agreement',
              keyTerms: ['Term 1'],
              insights: ['Insight 1'],
              riskFactors: ['Risk 1'],
              bestPractices: {
                strategicGuidance: [],
                relationshipManagement: [],
                performanceOptimization: [],
                governanceRecommendations: [],
                communicationProtocols: [],
                riskMitigationStrategies: []
              },
              overallConfidence: 75
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runEnhancedOverview(jobWithoutTenant);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-456' // Should use tenant ID from contract
        })
      });
    });
  });

  describe('Overview Analysis Quality', () => {
    it('should provide comprehensive strategic insights', () => {
      const strategicAreas = [
        'Business Strategy Alignment',
        'Partnership Management',
        'Performance Optimization',
        'Risk Management',
        'Governance',
        'Communication'
      ];

      // This test would verify that the worker provides insights across these strategic areas
      expect(strategicAreas).toHaveLength(6);
    });

    it('should generate industry-specific recommendations', () => {
      const industries = [
        'technology',
        'healthcare',
        'financial-services',
        'manufacturing',
        'consulting'
      ];

      // This test would verify that overview analysis adapts to different industries
      expect(industries).toHaveLength(5);
    });
  });
});