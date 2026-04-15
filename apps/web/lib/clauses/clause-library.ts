import { prisma } from '@/lib/prisma';

export interface ClauseLibraryFilters {
  category?: string | null;
  riskLevel?: string | null;
  search?: string | null;
  isStandard?: boolean;
  isMandatory?: boolean;
  limit?: number;
}

export interface ClauseLibraryItem {
  id: string;
  name: string;
  title: string;
  content: string;
  plainText: string;
  category: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  isStandard: boolean;
  isMandatory: boolean;
  isNegotiable: boolean;
  usageCount: number;
  variables: string[];
  alternativeVersions: string[];
  legalNotes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  jurisdiction?: string | null;
  contractTypes?: string[];
  sourceKind: 'clause-library';
}

export interface CreateClauseLibraryInput {
  name?: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  riskLevel?: string;
  alternativeText?: string | null;
  isStandard?: boolean;
  isMandatory?: boolean;
  isNegotiable?: boolean;
  jurisdiction?: string;
  contractTypes?: string[];
}

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

function normalizeCategoryForQuery(category?: string | null): string | undefined {
  if (!category || category === 'all') return undefined;
  return category.trim().replace(/\s+/g, '_').toUpperCase();
}

function normalizeRiskLevelForQuery(riskLevel?: string | null): string | undefined {
  if (!riskLevel || riskLevel === 'all') return undefined;
  return riskLevel.trim().toUpperCase();
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function extractVariables(content: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = variableRegex.exec(content)) !== null) {
    const variableName = match[1]?.trim();
    if (variableName && !variables.includes(variableName)) {
      variables.push(variableName);
    }
  }

  return variables;
}

function stripHtml(content: string): string {
  return content.replace(/<[^>]*>/g, '').replace(/\{\{[^}]+\}\}/g, '').trim();
}

function toClauseLibraryItem(clause: Record<string, unknown>): ClauseLibraryItem {
  const content = typeof clause.content === 'string' ? clause.content : '';
  const alternativeText = typeof clause.alternativeText === 'string' ? clause.alternativeText : null;

  return {
    id: String(clause.id || ''),
    name: typeof clause.name === 'string' ? clause.name : '',
    title: typeof clause.title === 'string' ? clause.title : typeof clause.name === 'string' ? clause.name : '',
    content,
    plainText: typeof clause.plainText === 'string' ? clause.plainText : stripHtml(content),
    category: typeof clause.category === 'string' ? clause.category : 'GENERAL',
    tags: normalizeStringArray(clause.tags),
    riskLevel: normalizeRiskLevelForQuery(typeof clause.riskLevel === 'string' ? clause.riskLevel : null)?.toLowerCase() as 'low' | 'medium' | 'high' || 'medium',
    isStandard: Boolean(clause.isStandard),
    isMandatory: Boolean(clause.isMandatory),
    isNegotiable: clause.isNegotiable !== false,
    usageCount: typeof clause.usageCount === 'number' ? clause.usageCount : 0,
    variables: extractVariables(content),
    alternativeVersions: alternativeText ? [alternativeText] : [],
    legalNotes: '',
    createdAt: clause.createdAt instanceof Date ? clause.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: clause.updatedAt instanceof Date ? clause.updatedAt.toISOString() : new Date().toISOString(),
    createdBy: typeof clause.createdBy === 'string' ? clause.createdBy : null,
    jurisdiction: typeof clause.jurisdiction === 'string' ? clause.jurisdiction : null,
    contractTypes: normalizeStringArray(clause.contractTypes),
    sourceKind: 'clause-library',
  };
}

export async function ensureDefaultClauseLibrary(tenantId: string): Promise<void> {
  const count = await prisma.clauseLibrary.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.clauseLibrary.createMany({
    data: defaultLibraryClauses.map((clause) => ({
      ...clause,
      tenantId,
      createdBy: 'system',
      plainText: stripHtml(clause.content),
      contractTypes: [],
    })),
    skipDuplicates: true,
  });
}

export async function listClauseLibrary(
  tenantId: string,
  filters: ClauseLibraryFilters = {},
  options: { seedDefaults?: boolean } = {},
): Promise<ClauseLibraryItem[]> {
  if (options.seedDefaults) {
    await ensureDefaultClauseLibrary(tenantId);
  }

  const where: Record<string, unknown> = { tenantId };
  const normalizedCategory = normalizeCategoryForQuery(filters.category);
  const normalizedRiskLevel = normalizeRiskLevelForQuery(filters.riskLevel);

  if (normalizedCategory) {
    where.category = normalizedCategory;
  }

  if (normalizedRiskLevel) {
    where.riskLevel = normalizedRiskLevel;
  }

  if (filters.isStandard !== undefined) {
    where.isStandard = filters.isStandard;
  }

  if (filters.isMandatory !== undefined) {
    where.isMandatory = filters.isMandatory;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { content: { contains: filters.search, mode: 'insensitive' } },
      { plainText: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const clauses = await prisma.clauseLibrary.findMany({
    where,
    orderBy: [
      { usageCount: 'desc' },
      { title: 'asc' },
    ],
    take: Math.min(Math.max(filters.limit ?? 50, 1), 200),
  });

  return clauses.map((clause) => toClauseLibraryItem(clause as unknown as Record<string, unknown>));
}

export async function createClauseLibraryEntry(
  tenantId: string,
  userId: string,
  input: CreateClauseLibraryInput,
): Promise<ClauseLibraryItem> {
  const normalizedName = (input.name || input.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);

  const content = input.content.trim();
  const tags = input.tags || [];
  const contractTypes = input.contractTypes || [];

  const clause = await prisma.clauseLibrary.create({
    data: {
      tenantId,
      name: `${normalizedName}_${Date.now()}`,
      title: input.title.trim(),
      category: normalizeCategoryForQuery(input.category) || 'GENERAL',
      content,
      plainText: stripHtml(content),
      riskLevel: normalizeRiskLevelForQuery(input.riskLevel) || 'MEDIUM',
      isStandard: input.isStandard ?? false,
      isMandatory: input.isMandatory ?? false,
      isNegotiable: input.isNegotiable ?? true,
      tags,
      jurisdiction: input.jurisdiction,
      contractTypes,
      alternativeText: input.alternativeText || null,
      createdBy: userId,
    },
  });

  return toClauseLibraryItem(clause as unknown as Record<string, unknown>);
}