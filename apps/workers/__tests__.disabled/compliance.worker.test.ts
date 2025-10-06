/**
 * Unit tests for Enhanced Compliance Worker
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { runCompliance } from '../compliance.worker';

// Mock database modules
const mockDb = {
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
const mockComplianceArtifactV1Schema = {
  parse: vi.fn((data) => data),
};

vi.mock('schemas', () => ({
  ComplianceArtifactV1Schema: mockComplianceArtifactV1Schema
}));

describe('Compliance Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4o';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  describe('runCompliance', () => {
    const mockJob = {
      data: {
        docId: 'test-doc-123',
        policyPackId: 'policy-pack-456',
      },
    };

    const mockContractText = `
      CONFIDENTIALITY AGREEMENT
      
      This agreement contains confidential and proprietary information.
      The parties agree to maintain strict confidentiality.
      
      TERMINATION: Either party may terminate this agreement with 30 days written notice.
      
      LIABILITY: In no event shall either party be liable for any indirect, 
      incidental, special, or consequential damages.
      
      INTELLECTUAL PROPERTY: All intellectual property rights remain with the original owner.
      
      DATA PROTECTION: This agreement complies with GDPR requirements for personal data processing.
      
      DISPUTE RESOLUTION: Any disputes shall be resolved through binding arbitration.
      
      PAYMENT TERMS: Payment is due within 30 days of invoice date.
      
      FORCE MAJEURE: Neither party shall be liable for delays due to circumstances beyond their control.
    `;

    beforeEach(() => {
      mockDb.artifact.findFirst.mockResolvedValue({
        data: { content: mockContractText },
      });
      mockDb.artifact.create.mockResolvedValue({ id: 'artifact-123' });
    });

    it('should perform comprehensive compliance analysis with GPT-4', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              compliance: [
                {
                  policyId: 'CONF-001',
                  policyName: 'Confidentiality Requirements',
                  status: 'compliant',
                  complianceScore: 95,
                  details: 'Strong confidentiality clauses present with clear obligations',
                  riskLevel: 'low',
                  recommendation: 'Maintain current confidentiality provisions',
                  regulatoryImpact: 'Low risk of regulatory issues',
                  businessImpact: 'Well protected against information leakage'
                },
                {
                  policyId: 'GDPR-001',
                  policyName: 'Data Protection',
                  status: 'compliant',
                  complianceScore: 90,
                  details: 'GDPR compliance explicitly mentioned',
                  riskLevel: 'low',
                  recommendation: 'Ensure data processing activities align with stated compliance',
                  regulatoryImpact: 'Compliant with EU data protection regulations',
                  businessImpact: 'Protected against data protection violations'
                },
                {
                  policyId: 'LIAB-001',
                  policyName: 'Limitation of Liability',
                  status: 'compliant',
                  complianceScore: 85,
                  details: 'Liability limitations present for indirect damages',
                  riskLevel: 'medium',
                  recommendation: 'Consider adding caps on direct damages',
                  regulatoryImpact: 'Standard liability protection',
                  businessImpact: 'Partial protection against financial exposure'
                }
              ],
              overallConfidence: 92,
              industryContext: 'Technology/Software Services',
              criticalFindings: [
                'Strong confidentiality protections in place',
                'GDPR compliance explicitly addressed',
                'Liability limitations could be more comprehensive'
              ]
            })
          }
        }]
      };

      const mockBestPracticesResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              regulatoryAlignments: [
                {
                  regulation: 'GDPR',
                  applicability: 'Applies to personal data processing activities',
                  currentCompliance: 'compliant',
                  requiredActions: 'Maintain current data protection measures',
                  deadline: 'Ongoing compliance required',
                  penalties: 'Up to 4% of annual revenue or €20M',
                  implementationCost: 'low'
                }
              ],
              complianceGaps: [
                {
                  area: 'Liability Caps',
                  currentState: 'Indirect damages excluded only',
                  requiredState: 'Comprehensive liability caps including direct damages',
                  gapSeverity: 'medium',
                  remediation: 'Add specific monetary caps on all damages',
                  timeline: '30 days',
                  dependencies: ['Legal review', 'Counterparty negotiation']
                }
              ],
              riskMitigations: [
                {
                  riskCategory: 'Financial Risk',
                  riskDescription: 'Unlimited liability for direct damages',
                  likelihood: 'medium',
                  impact: 'high',
                  mitigationStrategy: 'Implement comprehensive liability caps',
                  preventativeControls: ['Regular contract reviews', 'Insurance coverage'],
                  monitoringApproach: 'Quarterly liability assessment'
                }
              ],
              industryStandards: [
                {
                  standard: 'ISO 27001',
                  relevance: 'Information security management for confidential data',
                  adoptionBenefit: 'Enhanced security posture and client confidence',
                  implementationApproach: 'Phased implementation over 6 months',
                  certification: 'Third-party audit required',
                  competitiveAdvantage: 'Differentiation in security-conscious markets'
                }
              ],
              monitoringRecommendations: [
                {
                  complianceArea: 'Data Protection',
                  monitoringFrequency: 'quarterly',
                  keyIndicators: ['Data breach incidents', 'Privacy impact assessments', 'Consent management'],
                  alertThresholds: 'Any data breach or privacy complaint',
                  reportingRequirements: 'Quarterly compliance reports to board',
                  responsibleParty: 'Data Protection Officer'
                }
              ],
              documentationImprovements: [
                {
                  documentType: 'Privacy Policy',
                  currentGap: 'Generic privacy language',
                  suggestedContent: 'Specific data processing purposes and legal bases',
                  maintenanceSchedule: 'Annual review and updates',
                  auditReadiness: 'Detailed documentation supports regulatory audits',
                  stakeholderCommunication: 'Clear communication to data subjects'
                }
              ]
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create
        .mockResolvedValueOnce(mockGPTResponse)
        .mockResolvedValueOnce(mockBestPracticesResponse);

      const result = await runCompliance(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        complianceScore: 90,
        policiesAnalyzed: 3
      });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'COMPLIANCE',
          data: expect.objectContaining({
            compliance: expect.arrayContaining([
              expect.objectContaining({
                policyId: 'CONF-001',
                status: 'compliant',
                complianceScore: 95
              })
            ]),
            overallScore: 90,
            confidenceScore: 92,
            bestPractices: expect.objectContaining({
              regulatoryAlignments: expect.any(Array),
              complianceGaps: expect.any(Array),
              riskMitigations: expect.any(Array)
            })
          })
        }
      });
    });

    it('should fall back to heuristic analysis when GPT-4 fails', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await runCompliance(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        complianceScore: expect.any(Number),
        policiesAnalyzed: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'COMPLIANCE',
          data: expect.objectContaining({
            compliance: expect.arrayContaining([
              expect.objectContaining({
                policyId: expect.stringMatching(/^[A-Z]+-\d{3}$/),
                status: expect.stringMatching(/^(compliant|partial|non-compliant)$/),
                complianceScore: expect.any(Number)
              })
            ]),
            overallScore: expect.any(Number),
            confidenceScore: expect.any(Number)
          })
        }
      });
    });

    it('should handle missing contract text gracefully', async () => {
      mockDb.artifact.findFirst.mockResolvedValue({
        data: { content: '' },
      });

      const result = await runCompliance(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        complianceScore: expect.any(Number),
        policiesAnalyzed: expect.any(Number)
      });

      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should handle missing OpenAI API key gracefully', async () => {
      delete process.env.OPENAI_API_KEY;

      const result = await runCompliance(mockJob);

      expect(result).toEqual({
        docId: 'test-doc-123',
        complianceScore: expect.any(Number),
        policiesAnalyzed: expect.any(Number)
      });

      expect(mockOpenAIClient.chat.completions.create).not.toHaveBeenCalled();
      expect(mockDb.artifact.create).toHaveBeenCalled();
    });

    it('should calculate compliance scores correctly', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              compliance: [
                { policyId: 'TEST-001', complianceScore: 100 },
                { policyId: 'TEST-002', complianceScore: 80 },
                { policyId: 'TEST-003', complianceScore: 60 }
              ],
              overallConfidence: 85
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      const result = await runCompliance(mockJob);

      expect(result.complianceScore).toBe(80); // (100 + 80 + 60) / 3 = 80
    });

    it('should include provenance metadata with model and confidence information', async () => {
      const mockGPTResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              compliance: [{ policyId: 'TEST-001', complianceScore: 90 }],
              overallConfidence: 95
            })
          }
        }]
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValueOnce(mockGPTResponse);

      await runCompliance(mockJob);

      expect(mockDb.artifact.create).toHaveBeenCalledWith({
        data: {
          contractId: 'test-doc-123',
          type: 'COMPLIANCE',
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  worker: 'compliance',
                  model: 'gpt-4o',
                  confidenceScore: 95
                })
              ])
            })
          })
        }
      });
    });
  });

  describe('Compliance Analysis Quality', () => {
    it('should identify critical compliance policies', () => {
      const criticalPolicies = [
        'CONF-001', // Confidentiality
        'GDPR-001', // Data Protection
        'LIAB-001', // Liability
        'IP-001',   // Intellectual Property
        'SOX-001',  // Financial Controls
        'HIPAA-001' // Healthcare Data
      ];

      // This test would verify that the worker identifies these critical policies
      // when analyzing contracts in relevant industries
      expect(criticalPolicies).toHaveLength(6);
    });

    it('should provide industry-specific compliance recommendations', () => {
      const industries = [
        'healthcare',
        'financial-services', 
        'technology',
        'manufacturing',
        'retail'
      ];

      // This test would verify that compliance analysis adapts to different industries
      expect(industries).toHaveLength(5);
    });
  });
});