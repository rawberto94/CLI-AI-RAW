/**
 * Import PolicyRules from a Playbook (red flags → PATTERN, walkaway → CRITICAL).
 */

import type { PolicyRuleDef } from './types';

function codeFrom(prefix: string, name: string, i: number): string {
  const slug = String(name || 'rule')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `${prefix}-${slug || 'X'}-${i + 1}`;
}

export function rulesFromPlaybook(playbook: {
  id: string;
  redFlags?: Array<{
    id?: string;
    name?: string;
    pattern?: string;
    description?: string;
    severity?: string;
    category?: string;
  }>;
  clauses?: Array<{
    id?: string;
    name?: string;
    category?: string;
    riskLevel?: string;
    walkawayTriggers?: string[] | unknown;
    preferredText?: string;
  }>;
}): Array<Omit<PolicyRuleDef, 'id'> & { id?: string }> {
  const rules: Array<Omit<PolicyRuleDef, 'id'> & { id?: string }> = [];
  let i = 0;

  for (const rf of playbook.redFlags || []) {
    const pattern = rf.pattern || rf.name;
    if (!pattern) continue;
    rules.push({
      code: codeFrom('RF', rf.name || pattern, i++),
      title: rf.name || `Red flag: ${pattern}`,
      kind: 'PATTERN',
      severity: (String(rf.severity || 'CRITICAL').toUpperCase() as any) || 'CRITICAL',
      category: rf.category || 'other',
      match: {
        mode: 'must_not_match',
        patterns: [pattern],
        isRegex: false,
        caseSensitive: false,
      },
      remediation: rf.description || undefined,
      isActive: true,
      sortOrder: i,
    });
  }

  for (const clause of playbook.clauses || []) {
    const triggers = Array.isArray(clause.walkawayTriggers)
      ? (clause.walkawayTriggers as string[])
      : [];
    for (const trigger of triggers) {
      if (!trigger || typeof trigger !== 'string') continue;
      rules.push({
        code: codeFrom('WA', clause.name || clause.category || 'clause', i++),
        title: `Walkaway: ${clause.name || trigger}`,
        kind: 'PATTERN',
        severity: 'CRITICAL',
        category: clause.category || 'other',
        match: {
          mode: 'must_not_match',
          patterns: [trigger],
          isRegex: false,
          caseSensitive: false,
        },
        remediation: clause.preferredText
          ? `Replace with preferred language: ${String(clause.preferredText).slice(0, 200)}`
          : undefined,
        playbookClauseId: clause.id,
        isActive: true,
        sortOrder: i,
      });
    }
  }

  return rules;
}

export async function importPackFromPlaybook(args: {
  prisma: any;
  tenantId: string;
  playbookId: string;
  createdBy: string;
  name?: string;
  mode?: 'advisory' | 'gate';
}): Promise<{ packId: string; ruleCount: number }> {
  const { prisma, tenantId, playbookId, createdBy, mode = 'advisory' } = args;

  const playbook = await prisma.playbook.findFirst({
    where: { id: playbookId, tenantId },
    include: {
      redFlags: true,
      clauses: true,
    },
  });

  if (!playbook) {
    throw new Error('Playbook not found');
  }

  const ruleDefs = rulesFromPlaybook(playbook);
  const name = args.name || `${playbook.name} Policy Pack`;

  // Find next version if name exists
  const existing = await prisma.policyPack.findFirst({
    where: { tenantId, name },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (existing?.version ?? 0) + 1;

  const pack = await prisma.policyPack.create({
    data: {
      tenantId,
      name,
      description: `Imported from playbook "${playbook.name}"`,
      version,
      status: 'draft',
      mode,
      playbookId: playbook.id,
      scope: {},
      scoring: {},
      isDefault: false,
      createdBy,
      rules: {
        create: ruleDefs.map((r, idx) => ({
          code: r.code,
          title: r.title,
          kind: r.kind,
          severity: r.severity,
          category: r.category,
          appliesTo: r.appliesTo || {},
          assert: r.assert ?? undefined,
          match: r.match ?? undefined,
          semantic: r.semantic ?? undefined,
          escalateToSemantic: Boolean(r.escalateToSemantic),
          remediation: r.remediation,
          playbookClauseId: r.playbookClauseId,
          sortOrder: idx,
          isActive: true,
        })),
      },
    },
  });

  return { packId: pack.id, ruleCount: ruleDefs.length };
}
