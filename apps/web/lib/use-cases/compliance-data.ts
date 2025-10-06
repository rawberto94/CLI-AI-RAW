/**
 * Mock data for Compliance Health Check use case
 */

export const mockComplianceData = {
  overallScore: 67,
  regulations: {
    GDPR: {
      status: 'Partial' as const,
      score: 70,
      requiredClauses: 12,
      foundClauses: 8,
      gaps: [
        'Data retention period not specified',
        'Right to erasure clause missing',
        'Data processing agreement incomplete',
        'Cross-border transfer provisions unclear'
      ]
    },
    SOX: {
      status: 'Compliant' as const,
      score: 95,
      requiredClauses: 8,
      foundClauses: 8,
      gaps: []
    },
    CCPA: {
      status: 'Non-Compliant' as const,
      score: 45,
      requiredClauses: 10,
      foundClauses: 4,
      gaps: [
        'Right to deletion not addressed',
        'Data disclosure requirements missing',
        'Opt-out mechanism not defined',
        'Consumer rights notice absent',
        'Third-party sharing terms unclear',
        'Data sale provisions missing'
      ]
    },
    HIPAA: {
      status: 'Not Applicable' as const,
      score: 0,
      requiredClauses: 0,
      foundClauses: 0,
      gaps: []
    }
  },
  riskExposure: 890000,
  remediationTime: '2-3 weeks',
  criticalIssues: [
    {
      severity: 'Critical' as const,
      regulation: 'CCPA',
      issue: 'Missing consumer rights provisions',
      impact: 'Potential fines up to $7,500 per violation',
      remediation: 'Add comprehensive CCPA compliance clauses'
    },
    {
      severity: 'High' as const,
      regulation: 'GDPR',
      issue: 'Incomplete data processing terms',
      impact: 'Risk of regulatory action and fines',
      remediation: 'Update data processing agreement with required terms'
    },
    {
      severity: 'Medium' as const,
      regulation: 'GDPR',
      issue: 'Data retention period undefined',
      impact: 'Compliance uncertainty and audit risk',
      remediation: 'Specify clear data retention and deletion policies'
    }
  ],
  clauseAnalysis: [
    { clause: 'Confidentiality', status: 'Present' as const, strength: 'Strong', notes: 'Comprehensive NDA provisions' },
    { clause: 'Data Protection', status: 'Weak' as const, strength: 'Weak', notes: 'Missing key GDPR requirements' },
    { clause: 'Liability Limitation', status: 'Present' as const, strength: 'Moderate', notes: 'Standard cap at contract value' },
    { clause: 'Indemnification', status: 'Present' as const, strength: 'Strong', notes: 'Mutual indemnification included' },
    { clause: 'Termination Rights', status: 'Present' as const, strength: 'Strong', notes: 'Clear termination provisions' },
    { clause: 'Force Majeure', status: 'Present' as const, strength: 'Moderate', notes: 'Standard force majeure clause' },
    { clause: 'Dispute Resolution', status: 'Present' as const, strength: 'Strong', notes: 'Arbitration and mediation process' },
    { clause: 'IP Rights', status: 'Weak' as const, strength: 'Weak', notes: 'Ownership terms need clarification' },
    { clause: 'Audit Rights', status: 'Missing' as const, strength: 'N/A', notes: 'No audit provisions found' },
    { clause: 'Insurance Requirements', status: 'Present' as const, strength: 'Moderate', notes: 'Standard coverage levels' }
  ],
  remediationPlan: [
    {
      priority: 1,
      action: 'Add CCPA consumer rights provisions',
      effort: '4-6 hours',
      owner: 'Legal Team',
      deadline: '1 week'
    },
    {
      priority: 2,
      action: 'Update GDPR data processing terms',
      effort: '6-8 hours',
      owner: 'Legal Team',
      deadline: '2 weeks'
    },
    {
      priority: 3,
      action: 'Define data retention policies',
      effort: '2-4 hours',
      owner: 'Compliance Team',
      deadline: '2 weeks'
    },
    {
      priority: 4,
      action: 'Strengthen IP ownership clauses',
      effort: '3-4 hours',
      owner: 'Legal Team',
      deadline: '3 weeks'
    },
    {
      priority: 5,
      action: 'Add audit rights provisions',
      effort: '2-3 hours',
      owner: 'Legal Team',
      deadline: '3 weeks'
    }
  ]
}

export const complianceTemplates = [
  {
    name: 'GDPR Data Processing Addendum',
    description: 'Standard DPA template with all required GDPR provisions',
    clauses: 12,
    downloadUrl: '/templates/gdpr-dpa.docx'
  },
  {
    name: 'CCPA Consumer Rights Notice',
    description: 'Template for CCPA compliance with consumer rights provisions',
    clauses: 8,
    downloadUrl: '/templates/ccpa-notice.docx'
  },
  {
    name: 'Standard Audit Rights Clause',
    description: 'Comprehensive audit rights and inspection provisions',
    clauses: 4,
    downloadUrl: '/templates/audit-rights.docx'
  }
]
