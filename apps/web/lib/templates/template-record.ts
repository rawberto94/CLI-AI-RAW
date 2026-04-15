export interface TemplateClauseRecord {
  id: string;
  clauseId?: string;
  title?: string;
  content: string;
  category?: string;
  variables?: string[];
  sourceKind?: string;
  isStandard?: boolean;
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

export function normalizeTemplateClauses(rawClauses: unknown): TemplateClauseRecord[] {
  if (!Array.isArray(rawClauses)) return [];

  return rawClauses.flatMap((rawClause, index) => {
    if (typeof rawClause === 'string') {
      return [{
        id: `embedded-${index + 1}`,
        content: rawClause,
        sourceKind: 'embedded',
      }];
    }

    if (!rawClause || typeof rawClause !== 'object') {
      return [];
    }

    const clause = rawClause as Record<string, unknown>;
    const sourceKind = typeof clause.sourceKind === 'string'
      ? clause.sourceKind
      : typeof clause.sourceLabel === 'string'
        ? clause.sourceLabel
        : 'embedded';
    const clauseId = typeof clause.clauseId === 'string'
      ? clause.clauseId
      : typeof clause.sourceId === 'string'
        ? clause.sourceId
        : undefined;
    const id = typeof clause.id === 'string' && clause.id.trim().length > 0
      ? clause.id
      : clauseId || `embedded-${index + 1}`;
    const content = typeof clause.content === 'string'
      ? clause.content
      : typeof clause.text === 'string'
        ? clause.text
        : typeof clause.body === 'string'
          ? clause.body
          : '';

    return [{
      id,
      clauseId,
      title: typeof clause.title === 'string'
        ? clause.title
        : typeof clause.name === 'string'
          ? clause.name
          : typeof clause.heading === 'string'
            ? clause.heading
            : undefined,
      content,
      category: typeof clause.category === 'string' ? clause.category : undefined,
      variables: normalizeStringArray(clause.variables),
      sourceKind,
      isStandard: typeof clause.isStandard === 'boolean' ? clause.isStandard : undefined,
    }];
  });
}

export function countTemplateClauses(rawClauses: unknown): number {
  return normalizeTemplateClauses(rawClauses).length;
}

export function toDocumentTemplateClauses(rawClauses: unknown): Array<{ id: string; title?: string; content: string }> {
  return normalizeTemplateClauses(rawClauses).map((clause) => ({
    id: clause.id,
    title: clause.title,
    content: clause.content,
  }));
}

export function transformTemplateRecord(template: Record<string, unknown>, detail = false) {
  const metadata = (template.metadata || {}) as Record<string, unknown>;
  const clauses = normalizeTemplateClauses(template.clauses);
  const variables = Array.isArray(metadata.variables) ? metadata.variables : [];

  return {
    ...template,
    status: metadata.status || (template.isActive ? 'active' : 'draft'),
    tags: metadata.tags || [],
    content: metadata.content || '',
    language: metadata.language || 'en-US',
    variables: detail ? variables : variables.length,
    clauses: detail ? clauses : clauses.length,
    lastModified: template.updatedAt,
    approvalStatus: metadata.approvalStatus || 'none',
    createdBy: template.createdBy || 'System',
  };
}