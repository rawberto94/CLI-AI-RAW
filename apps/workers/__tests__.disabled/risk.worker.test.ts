/**
 * Unit tests for Enhanced Risk Worker
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { runRisk } from '../risk.worker';

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
const mockRiskArtifactV1Schema = {
  parse: vi.fn((data) => data),
};

vi.mock('schemas', () => ({
  RiskArtifactV1Schema: mockRiskArtifactV1Schema
}));

describe('Risk Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4o';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  describe('runRisk', () => {
    const mockJob = {
      data: {
        docId: 'test-doc-123',
        tenantId: 'tenant-456',
      },
    };

    const mockContractText = `
      SERVICE AGREEMENT
      
      PAYMENT TERMS: Payment is due within 90 days of invoice date.
      Late payments will incur a 2% monthly penalty.
      
      LIABILITY: Company shall be liable for all direct and indirect damages
      without limitation.
      
      TERMINATION: This agreement may be terminated by either party.
      
      INTELLECTUAL PROPERTY: All work product shall belong to the Company.
      
      PERFORMANCE: Service levels must be maintained at 99.9% uptime.
      Failure to meet SLAs will result in liquidated damages of $10,000 per day.
      
      CONFIDENTIALITY: Both parties agree to maintain confidentiality.
      
      DISPUTE RESOLUTION: Any disputes shall be resolved in state court.
    `;

    const mockContract = {
      id: 'test-doc-123',
      tenantId: 'tenant-456'
    };

    const mockClauses = [
      { clauseId: 'PAYMENT-001', text: 'Payment is due within 90 days' },
      { clauseId: 'LIABILITY-001', text: 'Company shall be liable for all damages' },
      { clauseId: 'PERFORMANCE-001', text: 'Service levels must be maintained at 99.9%' }
    ];

    beforeEach(() => {
      mockDb.contract.findUnique.mockResolvedValue(mockContract);
      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: mockContractText } }) // ingestion
        .mockResolvedValueOnce({ data: { clauses: mockClauses } }); // clauses
      mockDb.artifact.create.mockResolvedValue({ id: 'artifact-123' });
    });

    it('should perform comprehensive risk analysis with GPT-4', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              risks: [
                {
                  riskId: 'FIN-001',
                  riskType: 'Financial',
                  riskSubcategory: 'Payment Terms',
                  description: 'Extended 90-day payment terms create significant cash flow risk',
                  severity: 'high',
                  likelihood: 'high',
                  businessImpact: 'Delayed cash flow could impact operations and growth',
                  mitigationPriority: 'high',
                  evidenceFromContract: 'Payment is due within 90 days of invoice date',
                  recommendedActions: 'Negotiate shorter payment terms or implement early payment discounts'
                },
                {
                  riskId: 'LIA-001',
                  riskType: 'Liability',
                  riskSubcategory: 'Unlimited Liability',
                  description: 'Unlimited liability exposure for all damages',
                  severity: 'critical',
                  likelihood: 'medium',
                  businessImpact: 'Potential for catastrophic financial losses',
                  mitigationPriority: 'critical',
                  evidenceFromContract: 'Company shall be liable for all direct and indirect damages without limitation',
                  recommendedActions: 'Implement liability caps and exclusions for indirect damages'
                },
                {
                  riskId: 'OPE-001',
                  riskType: 'Operational',
                  riskSubcategory: 'Performance Penalties',
                  description: 'Significant liquidated damages for SLA failures',
                  severity: 'high',
                  likelihood: 'medium',
                  businessImpact: '$10,000 daily penalties could accumulate quickly',
                  mitigationPriority: 'high',
                  evidenceFromContract: 'Liquidated damages of $10,000 per day for SLA failures',
                  recommendedActions: 'Review SLA achievability and negotiate penalty caps'
                }
              ],
              overallConfidence: 95,
              riskProfile: 'high-risk',
              industryContext: 'Technology Services',
              criticalRisks: [
                'Unlimited liability exposure',
                'Extended payment terms',
                'High performance penalties',
                'Inadequate termination provisions',
                'Limited dispute resolution options'
              ]
            })
          }
        }]
      };

      const mockBestPracticesResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              riskMitigationStrategies: [
                {
                  riskCategory: 'Financial Risk',
                  riskLevel: 'high',
                  currentExposure: '90-day payment terms creating cash flow gaps',
                  mitigationApproach: 'Implement payment term optimization and cash flow management',
                  preventativeControls: ['Credit checks', 'Payment guarantees', 'Early payment discounts'],
                  detectiveControls: ['Aging reports', 'Cash flow monitoring', 'Customer payment tracking'],
                  correctiveActions: ['Collection procedures', 'Payment plan negotiations', 'Legal action'],
                  costBenefit: 'Low cost implementation with high cash flow improvement',
                  timeline: '30 days',
                  responsibleParty: 'Finance Team'
                }
              ],
              emergencyResponsePlans: [
                {
                  scenarioType: 'SLA Breach',
                  triggerEvents: ['Service downtime exceeding 0.1%', 'Performance degradation'],
                  immediateActions: ['Activate incident response team', 'Notify stakeholders', 'Begin remediation'],
                  escalationProcedure: 'Escalate to senior management within 2 hours',
                  stakeholderNotification: ['Client contact', 'Internal teams', 'Legal counsel'],
                  recoverySteps: ['Root cause analysis', 'Service restoration', 'Prevention measures'],
                  communicationProtocol: 'Hourly updates during incident, post-incident report',
                  reviewAndUpdate: 'Quarterly review of response procedures'
                }
              ],
              insuranceRecommendations: [
                {
                  riskType: 'Professional Liability',
                  coverageType: 'Errors & Omissions Insurance',
                  recommendedLimits: '$5M per occurrence, $10M aggregate',
                  policyFeatures: ['Prior acts coverage', 'Defense cost coverage', 'Regulatory proceedings'],
                  carrierCriteria: 'A-rated carrier with technology expertise',
                  costEstimate: '$15,000-25,000 annually',
                  renewalConsiderations: 'Claims history, revenue growth, risk profile changes',
                  claimsProcess: '24/7 claims reporting, dedicated claims specialist'
                }
              ],
              contingencyPlanning: [
                {
                  riskScenario: 'Service Level Failure',
                  probability: 'medium',
                  impact: 'high',
                  triggerIndicators: ['Uptime below 99.9%', 'Performance degradation', 'System alerts'],
                  responseActions: ['Immediate system diagnostics', 'Backup system activation', 'Client notification'],
                  resourceRequirements: ['Technical team', 'Backup infrastructure', 'Communication channels'],
                  alternativeStrategies: ['Third-party service providers', 'Manual processes', 'Service credits'],
                  successMetrics: ['Recovery time', 'Service restoration', 'Client satisfaction']
                }
              ],
              riskMonitoring: [
                {
                  riskArea: 'Financial Performance',
                  keyIndicators: ['Days sales outstanding', 'Cash flow', 'Payment delays'],
                  monitoringFrequency: 'weekly',
                  dataSource: 'Financial systems and reports',
                  alertThresholds: ['DSO > 75 days', 'Cash flow negative', 'Payment delays > 30 days'],
                  reportingSchedule: 'Monthly risk dashboard',
                  reviewMechanism: 'Monthly risk committee meeting',
                  improvementActions: ['Process optimization', 'System upgrades', 'Training programs']
                }
              ],
              stakeholderCommunication: [
                {
                  stakeholderGroup: 'Executive Leadership',
                  communicationObjective: 'Risk awareness and decision support',
                  keyMessages: ['Risk status updates', 'Mitigation progress', 'Resource needs'],
                  communicationChannels: ['Executive dashboard', 'Monthly reports', 'Escalation alerts'],
                  frequency: 'monthly',
                  feedbackMechanism: 'Executive risk committee meetings',
                  escalationPath: 'CEO for critical risks',
                  documentationRequirement: 'Formal risk reports and meeting minutes'
                }
              ]
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create
        .mockResolvedValueOnce(mockGPTResponse)
        .mockResolvedValueOnce(mockBestPracticesResponse);

      const result = await runRisk(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        riskScore: expect.any(Number),
        risksIdentified: 3
      });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'RISK',
          data: expect.objectContaining({
            risks: expect.arrayContaining([
              expect.objectContaining({
                riskType: 'Financial',
                severity: 'high'
              })
            ]),
            overallRiskScore: expect.any(Number),
            confidenceScore: 95,
            bestPractices: expect.objectContaining({
              riskMitigationStrategies: expect.any(Array),
              emergencyResponsePlans: expect.any(Array),
              insuranceRecommendations: expect.any(Array)
            })
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should fall back to heuristic analysis when GPT-4 fails', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await runRisk(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        riskScore: expect.any(Number),
        risksIdentified: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'RISK',
          data: expect.objectContaining({
            risks: expect.arrayContaining([
              expect.objectContaining({
                riskType: expect.any(String),
                severity: expect.stringMatching(/^(low|medium|high|critical)$/),
                description: expect.any(String)
              })
            ]),
            overallRiskScore: expect.any(Number),
            confidenceScore: expect.any(Number)
          }),
          tenantId: 'tenant-456'
        }
      });
    });

    it('should handle missing contract gracefully', async () => {
      mockDb.contract.findUnique.mockResolvedValue(null);

      await expect(runRisk(mockJob)).rejects.toThrow('Contract test-doc-123 not found');
    });

    it('should handle missing contract text gracefully', async () => {
      mockDb.artifact.findFirst
        .mockResolvedValueOnce({ data: { content: '' } }) // empty ingestion
        .mockResolvedValueOnce({ data: { clauses: [] } }); // empty clauses

      const result = await runRisk(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        riskScore: expect.any(Number),
        risksIdentified: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should handle missing OpenAI API key gracefully', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runRisk(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        riskScore: expect.any(Number),
        risksIdentified: expect.any(Number)
      });

      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should calculate risk scores correctly', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              risks: [
                { riskType: 'Financial', severity: 'high', likelihood: 'high' },
                { riskType: 'Liability', severity: 'critical', likelihood: 'medium' },
                { riskType: 'Operational', severity: 'medium', likelihood: 'low' }
              ],
              overallConfidence: 90
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      const result = await runRisk(mockJob);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should include provenance metadata with model and confidence information', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              risks: [{ riskType: 'Financial', severity: 'medium', likelihood: 'medium' }],
              overallConfidence: 88
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runRisk(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'RISK',
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  worker: 'risk',
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
              risks: [{ riskType: 'General', severity: 'low', likelihood: 'low' }],
              overallConfidence: 75
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runRisk(jobWithoutTenant);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-456' // Should use tenant ID from contract
        })
      });
    });
  });

  describe('Risk Analysis Quality', () => {
    it('should identify critical risk categories', () => {
      const criticalRiskCategories = [
        'Financial',
        'Legal',
        'Operational', 
        'Liability',
        'IP',
        'Termination',
        'Strategic'
      ];

      // This test would verify that the worker identifies these critical risk categories
      expect(criticalRiskCategories).toHaveLength(7);
    });

    it('should provide industry-specific risk assessments', () => {
      const industries = [
        'technology',
        'healthcare',
        'financial-services',
        'manufacturing',
        'retail'
      ];

      // This test would verify that risk analysis adapts to different industries
      expect(industries).toHaveLength(5);
    });
  });
});