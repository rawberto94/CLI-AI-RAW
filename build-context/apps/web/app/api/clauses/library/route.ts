import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
// Default library clauses to seed if database is empty
const defaultLibraryClauses = [
  {
    name: 'standard_indemnification',
    title: 'Standard Indemnification',
    category: 'INDEMNIFICATION',
    content: 'Each party shall indemnify, defend, and hold harmless the other party, its officers, directors, employees, and agents from and against any and all claims, damages, losses, and expenses arising out of or resulting from the indemnifying party\'s breach of this Agreement or negligence.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['indemnification', 'standard'],
  },
  {
    name: 'data_protection',
    title: 'Data Protection & GDPR',
    category: 'DATA_PROTECTION',
    content: 'The parties agree to comply with all applicable data protection laws, including but not limited to the General Data Protection Regulation (GDPR). Each party shall implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk involved in processing personal data.',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: true,
    isNegotiable: false,
    tags: ['gdpr', 'data', 'privacy', 'mandatory'],
  },
  {
    name: 'force_majeure',
    title: 'Force Majeure',
    category: 'FORCE_MAJEURE',
    content: 'Neither party shall be liable for any failure or delay in performing its obligations under this Agreement if such failure or delay results from circumstances beyond the reasonable control of that party, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, or pandemics.',
    riskLevel: 'LOW',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['force majeure', 'acts of god'],
  },
  {
    name: 'confidentiality',
    title: 'Confidentiality',
    category: 'CONFIDENTIALITY',
    content: 'Each party agrees to maintain in strict confidence all Confidential Information disclosed by the other party, and to use such information solely for the purposes of this Agreement. "Confidential Information" means any non-public, proprietary information, including but not limited to trade secrets, technical data, and business information.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: true,
    isNegotiable: true,
    tags: ['confidentiality', 'nda', 'proprietary'],
  },
  {
    name: 'limitation_of_liability',
    title: 'Limitation of Liability',
    category: 'LIABILITY',
    content: 'IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, REGARDLESS OF THE CAUSE OF ACTION OR WHETHER SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. EACH PARTY\'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['liability', 'limitation', 'damages', 'cap'],
  },
  {
    name: 'dispute_resolution',
    title: 'Dispute Resolution',
    category: 'DISPUTE_RESOLUTION',
    content: 'Any dispute arising out of or in connection with this Agreement shall first be attempted to be resolved through good faith negotiations between the parties. If negotiations fail, the parties agree to submit the dispute to binding arbitration under the rules of the American Arbitration Association, with the arbitration to take place in the location agreed upon by both parties.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['dispute', 'arbitration', 'resolution'],
  },
  {
    name: 'termination_for_convenience',
    title: 'Termination for Convenience',
    category: 'TERMINATION',
    content: 'Either party may terminate this Agreement at any time for any reason by providing written notice to the other party at least thirty (30) days prior to the desired termination date. Upon termination, all rights and obligations shall cease except for those that by their nature should survive termination.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['termination', 'convenience', 'notice'],
  },
  {
    name: 'intellectual_property',
    title: 'Intellectual Property Rights',
    category: 'IP_RIGHTS',
    content: 'Each party retains all right, title, and interest in and to its pre-existing intellectual property. Any intellectual property developed jointly by the parties shall be jointly owned. Neither party shall use the other party\'s trademarks, logos, or other intellectual property without prior written consent.',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['ip', 'intellectual property', 'ownership', 'trademarks'],
  },
];

// GET /api/clauses/library - Get all library clauses
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getTenantIdFromRequest(request);
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const riskLevel = searchParams.get('riskLevel');
  const search = searchParams.get('search');
  const isStandard = searchParams.get('isStandard');
  const isMandatory = searchParams.get('isMandatory');

  // Try to get from database first
  try {
    // Check if library exists
    const count = await prisma.clauseLibrary.count({ where: { tenantId } });

    // Seed default clauses if empty
    if (count === 0) {
      await prisma.clauseLibrary.createMany({
        data: defaultLibraryClauses.map(clause => ({
          ...clause,
          tenantId,
          tags: JSON.stringify(clause.tags),
          createdBy: 'system',
        })),
        skipDuplicates: true,
      });
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (category) where.category = category;
    if (riskLevel) where.riskLevel = riskLevel;
    if (isStandard === 'true') where.isStandard = true;
    if (isMandatory === 'true') where.isMandatory = true;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clauses = await prisma.clauseLibrary.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { title: 'asc' },
      ],
    });

    return createSuccessResponse(ctx, { 
      clauses: clauses.map(c => ({
        ...c,
        tags: typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags,
      })),
      source: 'database',
      total: clauses.length,
    });
  } catch {
    // Fallback to default clauses
    let filteredClauses = defaultLibraryClauses.map((c, i) => ({
      ...c,
      id: `lib${i + 1}`,
      tenantId,
      usageCount: Math.floor(Math.random() * 100),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (category) {
      filteredClauses = filteredClauses.filter(c => c.category === category);
    }
    if (riskLevel) {
      filteredClauses = filteredClauses.filter(c => c.riskLevel === riskLevel);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredClauses = filteredClauses.filter(c => 
        c.title.toLowerCase().includes(searchLower) ||
        c.content.toLowerCase().includes(searchLower)
      );
    }

    return createSuccessResponse(ctx, { 
      clauses: filteredClauses,
      source: 'default',
      total: filteredClauses.length,
    });
  }
});

// POST /api/clauses/library - Add clause to library
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getTenantIdFromRequest(request);
  const body = await request.json();
  const { 
    name, 
    title, 
    category, 
    content, 
    riskLevel = 'MEDIUM',
    isStandard = false,
    isMandatory = false,
    isNegotiable = true,
    tags = [],
    jurisdiction,
    contractTypes = [],
    alternativeText,
  } = body;

  if (!name || !title || !category || !content) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Missing required fields: name, title, category, content', 400);
  }

  try {
    const clause = await prisma.clauseLibrary.create({
      data: {
        tenantId,
        name,
        title,
        category,
        content,
        plainText: content.replace(/<[^>]*>/g, ''), // Strip HTML
        riskLevel,
        isStandard,
        isMandatory,
        isNegotiable,
        tags: JSON.stringify(tags),
        jurisdiction,
        contractTypes: JSON.stringify(contractTypes),
        alternativeText,
        createdBy: ctx.userId
      },
    });

    return createSuccessResponse(ctx, { 
      clause: {
        ...clause,
        tags: typeof clause.tags === 'string' ? JSON.parse(clause.tags as string) : clause.tags,
      },
      source: 'database',
    });
  } catch {
    // Return mock response for development
    const newClause = {
      id: `lib-${Date.now()}`,
      tenantId,
      name,
      title,
      category,
      content,
      riskLevel,
      isStandard,
      isMandatory,
      isNegotiable,
      tags,
      usageCount: 0,
      createdBy: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return createSuccessResponse(ctx, { 
      clause: newClause,
      source: 'memory',
      warning: 'Database unavailable, clause not persisted',
    });
  }
});
