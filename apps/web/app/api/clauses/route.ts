import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock clauses for fallback
const mockClauses = [
  {
    id: 'clause-1',
    title: 'Mutual Confidentiality Obligation',
    content: 'Both parties agree to maintain strict confidentiality regarding any proprietary or confidential information disclosed during the term of this agreement. Neither party shall disclose such information to any third party without prior written consent.',
    category: 'Confidentiality',
    subcategory: 'Mutual Confidentiality',
    tags: ['confidentiality', 'nda', 'mutual', 'disclosure'],
    riskLevel: 'medium' as const,
    isStandard: true,
    isFavorite: true,
    usageCount: 89,
    variables: ['term_length', 'exceptions'],
    alternativeVersions: [
      'Each party shall protect confidential information with the same degree of care used for its own confidential information, but no less than reasonable care.',
    ],
    legalNotes: 'Consider adding specific exceptions for information already publicly available or independently developed.',
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-11-05').toISOString(),
  },
  {
    id: 'clause-2',
    title: 'Standard Termination for Convenience',
    content: 'Either party may terminate this Agreement for any reason upon {{notice_period}} days written notice to the other party. Upon termination, all rights and obligations shall cease except those that by their nature should survive termination.',
    category: 'Termination',
    subcategory: 'Termination for Convenience',
    tags: ['termination', 'notice', 'convenience', 'exit'],
    riskLevel: 'low' as const,
    isStandard: true,
    isFavorite: false,
    usageCount: 156,
    variables: ['notice_period'],
    alternativeVersions: [
      'This Agreement may be terminated by either party with {{notice_period}} days advance written notice, without cause.',
    ],
    legalNotes: 'Ensure notice period aligns with business needs. Consider adding provisions for outstanding payments.',
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-10-28').toISOString(),
  },
  {
    id: 'clause-3',
    title: 'Net 30 Payment Terms',
    content: 'Client shall pay all undisputed invoices within thirty (30) days of the invoice date. Payment shall be made in {{currency}} via {{payment_method}}. Late payments shall accrue interest at {{interest_rate}}% per month.',
    category: 'Payment Terms',
    subcategory: 'Standard Payment',
    tags: ['payment', 'net-30', 'invoice', 'late-fee'],
    riskLevel: 'low' as const,
    isStandard: true,
    isFavorite: true,
    usageCount: 203,
    variables: ['currency', 'payment_method', 'interest_rate'],
    alternativeVersions: [
      'All invoices are due and payable within thirty (30) days from invoice date. Interest on overdue amounts shall be {{interest_rate}}% per annum.',
      'Payment terms are Net 30 days. A late fee of {{late_fee_percent}}% will apply to overdue balances.',
    ],
    legalNotes: 'Verify interest rate complies with local usury laws. Consider early payment discounts.',
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date('2024-11-12').toISOString(),
  },
  {
    id: 'clause-4',
    title: 'Limited Liability Cap',
    content: 'In no event shall either party\'s total liability arising out of or related to this Agreement exceed {{liability_cap}}. This limitation applies regardless of the form of action, whether in contract, tort, or otherwise.',
    category: 'Liability',
    subcategory: 'Liability Cap',
    tags: ['liability', 'limitation', 'cap', 'damages'],
    riskLevel: 'high' as const,
    isStandard: true,
    isFavorite: false,
    usageCount: 78,
    variables: ['liability_cap'],
    alternativeVersions: [
      'Maximum aggregate liability under this Agreement shall not exceed the total fees paid in the twelve (12) months preceding the claim.',
      'Liability is limited to {{liability_cap}} or the amount paid under this Agreement, whichever is greater.',
    ],
    legalNotes: 'CRITICAL: Ensure cap amount is reasonable and reviewed by legal counsel. May not apply to gross negligence or willful misconduct in some jurisdictions.',
    createdAt: new Date('2024-02-10').toISOString(),
    updatedAt: new Date('2024-09-15').toISOString(),
  },
  {
    id: 'clause-5',
    title: 'Work Product Ownership',
    content: 'All work product, deliverables, and intellectual property created by {{creator_party}} in connection with this Agreement shall be deemed works made for hire and shall be the exclusive property of {{owner_party}}. {{creator_party}} hereby assigns all rights, title, and interest to {{owner_party}}.',
    category: 'Intellectual Property',
    subcategory: 'Work for Hire',
    tags: ['ip', 'ownership', 'work-product', 'assignment'],
    riskLevel: 'medium' as const,
    isStandard: true,
    isFavorite: true,
    usageCount: 124,
    variables: ['creator_party', 'owner_party'],
    alternativeVersions: [
      'Client shall own all intellectual property rights in work product created under this Agreement upon full payment.',
      'Upon completion and payment, all IP rights transfer to Client, with Vendor retaining rights to pre-existing materials.',
    ],
    legalNotes: 'Consider carving out pre-existing IP and tools. Ensure assignment language is explicit. May need separate IP assignment agreement.',
    createdAt: new Date('2024-03-05').toISOString(),
    updatedAt: new Date('2024-11-08').toISOString(),
  },
  {
    id: 'clause-6',
    title: 'Arbitration Agreement',
    content: 'Any dispute arising out of or relating to this Agreement shall be resolved through binding arbitration in accordance with the rules of {{arbitration_body}} in {{arbitration_location}}. The decision of the arbitrator shall be final and binding. Each party shall bear its own costs.',
    category: 'Dispute Resolution',
    subcategory: 'Binding Arbitration',
    tags: ['arbitration', 'dispute', 'resolution', 'adr'],
    riskLevel: 'high' as const,
    isStandard: true,
    isFavorite: false,
    usageCount: 67,
    variables: ['arbitration_body', 'arbitration_location'],
    alternativeVersions: [
      'Disputes shall be resolved by mediation, and if unsuccessful, by arbitration under {{arbitration_body}} rules.',
      'Any controversy shall be settled by arbitration by a single arbitrator in {{arbitration_location}}.',
    ],
    legalNotes: 'IMPORTANT: Arbitration clauses may limit access to courts. Consider carving out injunctive relief. Verify enforceability in relevant jurisdictions.',
    createdAt: new Date('2024-03-20').toISOString(),
    updatedAt: new Date('2024-10-01').toISOString(),
  },
  {
    id: 'clause-7',
    title: 'Force Majeure',
    content: 'Neither party shall be liable for failure to perform its obligations due to events beyond its reasonable control, including but not limited to acts of God, war, terrorism, pandemic, natural disasters, or government actions ("Force Majeure Events"). Performance shall be suspended during the Force Majeure Event and for {{recovery_period}} thereafter.',
    category: 'Force Majeure',
    subcategory: 'Standard Force Majeure',
    tags: ['force-majeure', 'excuse', 'pandemic', 'act-of-god'],
    riskLevel: 'medium' as const,
    isStandard: true,
    isFavorite: true,
    usageCount: 95,
    variables: ['recovery_period'],
    alternativeVersions: [
      'Performance excused for events beyond reasonable control including natural disasters, strikes, war, or governmental restrictions.',
    ],
    legalNotes: 'Consider what qualifies as force majeure. Should parties have obligation to mitigate? Include notice requirements and right to terminate if extended.',
    createdAt: new Date('2024-04-01').toISOString(),
    updatedAt: new Date('2024-11-01').toISOString(),
  },
  {
    id: 'clause-8',
    title: 'General Indemnification',
    content: '{{indemnifying_party}} agrees to indemnify, defend, and hold harmless {{indemnified_party}} from and against any and all claims, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or resulting from {{indemnifying_party}}\'s breach of this Agreement or negligent acts or omissions.',
    category: 'Indemnification',
    subcategory: 'General Indemnity',
    tags: ['indemnification', 'liability', 'defense', 'hold-harmless'],
    riskLevel: 'high' as const,
    isStandard: true,
    isFavorite: false,
    usageCount: 112,
    variables: ['indemnifying_party', 'indemnified_party'],
    alternativeVersions: [
      'Mutual indemnification: Each party shall indemnify the other for claims arising from its breach or negligence.',
      'Vendor indemnifies Client for third-party IP infringement claims related to deliverables.',
    ],
    legalNotes: 'CRITICAL: Review indemnity scope carefully. Consider caps, carve-outs, and insurance requirements. Mutual vs. one-way indemnity has significant risk implications.',
    createdAt: new Date('2024-04-15').toISOString(),
    updatedAt: new Date('2024-10-20').toISOString(),
  },
  {
    id: 'clause-9',
    title: 'Limited Warranty',
    content: '{{warranting_party}} warrants that services shall be performed in a professional and workmanlike manner consistent with industry standards. {{warranting_party}} warrants it has the authority to enter into this Agreement. EXCEPT AS EXPRESSLY PROVIDED, ALL SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.',
    category: 'Warranties',
    subcategory: 'Limited Warranty',
    tags: ['warranty', 'guarantee', 'as-is', 'disclaimer'],
    riskLevel: 'medium' as const,
    isStandard: true,
    isFavorite: true,
    usageCount: 143,
    variables: ['warranting_party'],
    alternativeVersions: [
      'Services performed with reasonable care and skill. No other warranties expressed or implied.',
      'Limited 30-day warranty on deliverables. All implied warranties disclaimed to extent permitted by law.',
    ],
    legalNotes: 'Balance warranty obligations with disclaimer. Some implied warranties cannot be disclaimed under consumer protection laws.',
    createdAt: new Date('2024-05-01').toISOString(),
    updatedAt: new Date('2024-11-10').toISOString(),
  },
  {
    id: 'clause-10',
    title: 'Non-Compete Restriction',
    content: 'During the term of this Agreement and for {{restriction_period}} thereafter, {{restricted_party}} shall not, directly or indirectly, engage in any business that competes with {{protected_party}} within {{geographic_scope}}. This restriction applies to {{restriction_activities}}.',
    category: 'Non-Compete',
    subcategory: 'Post-Term Restriction',
    tags: ['non-compete', 'restriction', 'covenant', 'competition'],
    riskLevel: 'high' as const,
    isStandard: false,
    isFavorite: false,
    usageCount: 34,
    variables: ['restriction_period', 'restricted_party', 'protected_party', 'geographic_scope', 'restriction_activities'],
    alternativeVersions: [
      'Non-compete limited to direct solicitation of Protected Party\'s clients for {{restriction_period}}.',
    ],
    legalNotes: 'CRITICAL: Non-compete enforceability varies widely by jurisdiction. Must be reasonable in scope, duration, and geography. Consider non-solicitation as alternative. Many states limit or ban non-competes.',
    createdAt: new Date('2024-06-01').toISOString(),
    updatedAt: new Date('2024-09-25').toISOString(),
  },
  {
    id: 'clause-11',
    title: 'GDPR Data Processing',
    content: 'To the extent {{processor}} processes personal data on behalf of {{controller}}, Processor shall comply with all applicable data protection laws including GDPR. Processor shall implement appropriate technical and organizational measures to ensure data security. Data processing shall be governed by the Data Processing Addendum attached hereto.',
    category: 'Data Protection',
    subcategory: 'GDPR Compliance',
    tags: ['gdpr', 'data-protection', 'privacy', 'dpa'],
    riskLevel: 'high' as const,
    isStandard: true,
    isFavorite: true,
    usageCount: 87,
    variables: ['processor', 'controller'],
    alternativeVersions: [
      'Both parties shall comply with applicable privacy laws including GDPR, CCPA, and maintain appropriate data security measures.',
    ],
    legalNotes: 'CRITICAL: GDPR compliance mandatory for EU data processing. Requires separate Data Processing Agreement (DPA). Include provisions for data breach notification, sub-processors, and data subject rights.',
    createdAt: new Date('2024-07-01').toISOString(),
    updatedAt: new Date('2024-11-13').toISOString(),
  },
  {
    id: 'clause-12',
    title: 'Regulatory Compliance',
    content: 'Each party shall comply with all applicable federal, state, and local laws, regulations, and ordinances in performance of this Agreement, including but not limited to {{specific_regulations}}. {{responsible_party}} shall obtain and maintain all necessary licenses, permits, and approvals.',
    category: 'Compliance',
    subcategory: 'General Compliance',
    tags: ['compliance', 'regulatory', 'laws', 'permits'],
    riskLevel: 'medium' as const,
    isStandard: true,
    isFavorite: false,
    usageCount: 76,
    variables: ['specific_regulations', 'responsible_party'],
    alternativeVersions: [
      'Parties represent compliance with all applicable laws including anti-corruption, export control, and sanctions laws.',
    ],
    legalNotes: 'Tailor to specific industry regulations (HIPAA, SOX, etc.). Consider audit rights and certification requirements.',
    createdAt: new Date('2024-08-01').toISOString(),
    updatedAt: new Date('2024-10-30').toISOString(),
  },
];

// GET /api/clauses - List all clauses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const favorite = searchParams.get('favorite');

    try {
      // Try database first
      let clauses = await prisma.clause.findMany({
        where: {
          ...(category && category !== 'all' ? { category } : {}),
          ...(riskLevel && riskLevel !== 'all' ? { riskLevel } : {}),
          ...(favorite === 'true' ? { isFavorite: true } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Parse JSON fields
      clauses = clauses.map((c: any) => ({
        ...c,
        tags: typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags,
        variables: typeof c.variables === 'string' ? JSON.parse(c.variables) : c.variables,
        alternativeVersions: c.alternativeVersions && typeof c.alternativeVersions === 'string' 
          ? JSON.parse(c.alternativeVersions) 
          : c.alternativeVersions,
      }));

      return NextResponse.json({ clauses, source: 'database' });
    } catch (dbError) {
      console.warn('Database unavailable, using mock data:', dbError);
      
      // Fallback to mock data
      let filtered = mockClauses;
      
      if (category && category !== 'all') {
        filtered = filtered.filter(c => c.category === category);
      }
      if (riskLevel && riskLevel !== 'all') {
        filtered = filtered.filter(c => c.riskLevel === riskLevel);
      }
      if (favorite === 'true') {
        filtered = filtered.filter(c => c.isFavorite);
      }

      return NextResponse.json({ clauses: filtered, source: 'mock' });
    }
  } catch (error) {
    console.error('Error fetching clauses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clauses' },
      { status: 500 }
    );
  }
}

// POST /api/clauses - Create new clause
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, subcategory, tags, riskLevel, legalNotes } = body;

    // Extract variables from content
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1].trim())) {
        variables.push(match[1].trim());
      }
    }

    try {
      const clause = await prisma.clause.create({
        data: {
          title,
          content,
          category,
          subcategory: subcategory || '',
          tags: JSON.stringify(tags || []),
          riskLevel: riskLevel || 'medium',
          isStandard: false,
          variables: JSON.stringify(variables),
          legalNotes: legalNotes || '',
        },
      });

      return NextResponse.json({
        clause: {
          ...clause,
          tags: JSON.parse(clause.tags as string),
          variables: JSON.parse(clause.variables as string),
        },
        source: 'database'
      });
    } catch (dbError) {
      console.warn('Database unavailable, returning mock response:', dbError);
      
      const mockClause = {
        id: `clause-${Date.now()}`,
        title,
        content,
        category,
        subcategory: subcategory || '',
        tags: tags || [],
        riskLevel: riskLevel || 'medium',
        isStandard: false,
        isFavorite: false,
        usageCount: 0,
        variables,
        alternativeVersions: [],
        legalNotes: legalNotes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return NextResponse.json({ clause: mockClause, source: 'mock' });
    }
  } catch (error) {
    console.error('Error creating clause:', error);
    return NextResponse.json(
      { error: 'Failed to create clause' },
      { status: 500 }
    );
  }
}
