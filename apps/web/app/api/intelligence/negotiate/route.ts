import { NextRequest, NextResponse } from 'next/server';

// Mock playbook rules
const playbookRules = [
  {
    id: 'rule1',
    name: 'Liability Cap',
    description: 'Liability should be capped at contract value or lower',
    category: 'risk',
    severity: 'critical',
    acceptableTerms: ['cap at contract value', 'limited to fees paid', 'capped at annual fees'],
    unacceptableTerms: ['unlimited liability', 'no cap', 'full liability'],
  },
  {
    id: 'rule2',
    name: 'Termination Rights',
    description: 'Must include termination for convenience with 30-day notice',
    category: 'flexibility',
    severity: 'major',
    acceptableTerms: ['30 days notice', 'termination for convenience', 'mutual termination rights'],
    unacceptableTerms: ['no termination rights', 'termination only for cause', 'lock-in period'],
  },
  {
    id: 'rule3',
    name: 'Data Protection',
    description: 'Must comply with GDPR and include DPA provisions',
    category: 'compliance',
    severity: 'critical',
    acceptableTerms: ['GDPR compliant', 'data protection agreement', 'processor agreement'],
    unacceptableTerms: ['no data protection', 'data shared freely'],
  },
  {
    id: 'rule4',
    name: 'Payment Terms',
    description: 'Payment terms should be Net 45 or longer',
    category: 'commercial',
    severity: 'minor',
    acceptableTerms: ['net 45', 'net 60', 'net 30 with discount'],
    unacceptableTerms: ['net 15', 'immediate payment', 'prepayment required'],
  },
  {
    id: 'rule5',
    name: 'IP Ownership',
    description: 'Customer retains IP for all custom deliverables',
    category: 'legal',
    severity: 'major',
    acceptableTerms: ['customer owns deliverables', 'work for hire', 'IP assigned to customer'],
    unacceptableTerms: ['vendor retains IP', 'shared ownership', 'licensed back'],
  },
];

// Mock analysis for a contract
const mockAnalysis = {
  summary: {
    totalClauses: 24,
    analyzed: 24,
    deviations: 5,
    critical: 1,
    major: 2,
    minor: 2,
  },
  deviations: [
    {
      id: 'dev1',
      clauseNumber: '7.2',
      clauseTitle: 'Limitation of Liability',
      originalText: 'The liability of the Vendor shall be unlimited for any claims arising from this Agreement.',
      issue: 'Unlimited liability violates company policy',
      ruleId: 'rule1',
      severity: 'critical',
      recommendation: 'Cap liability at total contract value ($1,200,000)',
      suggestedText: 'The liability of the Vendor shall be limited to the total fees paid under this Agreement.',
      riskScore: 95,
    },
    {
      id: 'dev2',
      clauseNumber: '12.1',
      clauseTitle: 'Termination',
      originalText: 'This Agreement may only be terminated for material breach.',
      issue: 'Missing termination for convenience clause',
      ruleId: 'rule2',
      severity: 'major',
      recommendation: 'Add termination for convenience with 30-day notice',
      suggestedText: 'Either party may terminate this Agreement for convenience upon thirty (30) days written notice.',
      riskScore: 75,
    },
    {
      id: 'dev3',
      clauseNumber: '15.3',
      clauseTitle: 'Intellectual Property',
      originalText: 'All deliverables shall be jointly owned by both parties.',
      issue: 'Joint IP ownership creates complications',
      ruleId: 'rule5',
      severity: 'major',
      recommendation: 'Customer should own all custom deliverables',
      suggestedText: 'All custom deliverables created under this Agreement shall be owned exclusively by Customer.',
      riskScore: 70,
    },
    {
      id: 'dev4',
      clauseNumber: '8.1',
      clauseTitle: 'Payment Terms',
      originalText: 'Payment shall be due within 15 days of invoice date.',
      issue: 'Payment terms shorter than policy minimum',
      ruleId: 'rule4',
      severity: 'minor',
      recommendation: 'Negotiate to Net 45 payment terms',
      suggestedText: 'Payment shall be due within 45 days of invoice date.',
      riskScore: 40,
    },
    {
      id: 'dev5',
      clauseNumber: '9.2',
      clauseTitle: 'Late Payment',
      originalText: 'Late payments shall accrue interest at 2% per month.',
      issue: 'Interest rate higher than market standard',
      ruleId: 'rule4',
      severity: 'minor',
      recommendation: 'Negotiate lower interest rate (1% or prime + 2%)',
      suggestedText: 'Late payments shall accrue interest at the prime rate plus 2% per annum.',
      riskScore: 35,
    },
  ],
  comparison: {
    addedClauses: 2,
    removedClauses: 0,
    modifiedClauses: 8,
    unchangedClauses: 14,
  },
  riskMatrix: {
    legal: { score: 65, issues: 2 },
    commercial: { score: 85, issues: 2 },
    operational: { score: 90, issues: 0 },
    compliance: { score: 95, issues: 1 },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, clauseText, playbook: _playbook } = body;

    if (action === 'analyze') {
      // Full contract analysis
      return NextResponse.json({
        success: true,
        data: {
          contractId: contractId || 'contract-1',
          analysis: mockAnalysis,
          playbook: playbookRules,
          recommendations: [
            {
              priority: 1,
              action: 'Address critical liability clause immediately',
              impact: 'High financial risk if unchanged',
            },
            {
              priority: 2,
              action: 'Negotiate IP ownership terms',
              impact: 'Potential IP disputes',
            },
            {
              priority: 3,
              action: 'Add termination for convenience',
              impact: 'Limited exit flexibility',
            },
          ],
          overallRisk: 'medium-high',
          negotiationReadiness: 65,
        },
      });
    }

    if (action === 'check-clause') {
      // Single clause check against playbook
      if (!clauseText) {
        return NextResponse.json(
          { success: false, error: 'Clause text is required' },
          { status: 400 }
        );
      }

      // Mock analysis of specific clause
      const violations = playbookRules.filter(rule =>
        rule.unacceptableTerms.some(term =>
          clauseText.toLowerCase().includes(term.toLowerCase())
        )
      );

      return NextResponse.json({
        success: true,
        data: {
          clauseText,
          violations: violations.map(v => ({
            rule: v.name,
            severity: v.severity,
            description: v.description,
            recommendation: v.acceptableTerms[0],
          })),
          isCompliant: violations.length === 0,
        },
      });
    }

    if (action === 'suggest-response') {
      // Generate negotiation response
      const { deviationId } = body;
      const deviation = mockAnalysis.deviations.find(d => d.id === deviationId);

      if (!deviation) {
        return NextResponse.json(
          { success: false, error: 'Deviation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          deviation,
          responseOptions: [
            {
              tone: 'firm',
              text: `We require modification to Section ${deviation.clauseNumber}. Our standard terms require: "${deviation.suggestedText}"`,
            },
            {
              tone: 'collaborative',
              text: `Regarding Section ${deviation.clauseNumber}, we'd like to discuss adjusting the language to: "${deviation.suggestedText}". This aligns with industry standards and provides mutual protection.`,
            },
            {
              tone: 'compromise',
              text: `For Section ${deviation.clauseNumber}, we propose meeting in the middle. While we understand your position, our risk assessment requires some adjustment. Would you consider: "${deviation.suggestedText}"?`,
            },
          ],
          precedents: [
            { contractName: 'Acme Corp MSA', outcome: 'Accepted our terms' },
            { contractName: 'TechVendor SLA', outcome: 'Negotiated 50% cap' },
          ],
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function GET() {
  // Return playbook rules
  return NextResponse.json({
    success: true,
    data: {
      playbook: playbookRules,
      categories: ['risk', 'flexibility', 'compliance', 'commercial', 'legal'],
      lastUpdated: '2024-03-15',
    },
  });
}
