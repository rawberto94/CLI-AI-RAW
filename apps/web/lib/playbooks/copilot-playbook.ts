import {
  getLegalReviewService,
  type CopilotContext,
  type Playbook,
} from 'data-orchestration/services';

type PlaybookRequestInput =
  | string
  | { id?: string | null; name?: string | null }
  | null
  | undefined;

function normalizeId(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function extractRequestedPlaybookId(
  playbook?: PlaybookRequestInput,
  playbookId?: string | null,
): string | undefined {
  const explicitId = normalizeId(playbookId);
  if (explicitId) {
    return explicitId;
  }

  if (typeof playbook === 'string') {
    return normalizeId(playbook);
  }

  if (playbook && typeof playbook === 'object') {
    return normalizeId(playbook.id);
  }

  return undefined;
}

export async function resolveRequestedPlaybook(
  tenantId: string,
  playbook?: PlaybookRequestInput,
  playbookId?: string | null,
): Promise<Playbook | undefined> {
  const resolvedPlaybookId = extractRequestedPlaybookId(playbook, playbookId);
  if (!resolvedPlaybookId) {
    return undefined;
  }

  return getLegalReviewService().getPlaybook(resolvedPlaybookId, tenantId);
}

export function mapPlaybookToCopilotReference(
  playbook: Playbook,
): NonNullable<CopilotContext['activePlaybook']> {
  const preferredLanguage = { ...(playbook.preferredLanguage || {}) };

  for (const clause of playbook.clauses || []) {
    const preferredText = clause.preferredText?.trim();
    if (!preferredText || preferredLanguage[clause.category]) {
      continue;
    }

    preferredLanguage[clause.category] = preferredText;
  }

  return {
    id: playbook.id,
    name: playbook.name,
    fallbackPositions: Object.fromEntries(
      Object.entries(playbook.fallbackPositions || {}).map(([k, v]) => [
        k,
        { ...v, fallback2: v.fallback2 ?? '' },
      ]),
    ),
    preferredLanguage,
    riskThresholds: playbook.riskThresholds as unknown as Record<string, number>,
  };
}

function compactText(value?: string, maxLength = 220): string {
  if (!value) {
    return '';
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function formatPlaybookPromptContext(playbook: Playbook): string {
  const clauseLines = (playbook.clauses || [])
    .slice(0, 6)
    .map((clause, index) => {
      const parts = [
        `${index + 1}. ${clause.category}: prefer \"${compactText(clause.preferredText, 260)}\"`,
      ];

      if (clause.minimumAcceptable) {
        parts.push(`minimum acceptable \"${compactText(clause.minimumAcceptable, 180)}\"`);
      }

      if (clause.negotiationGuidance) {
        parts.push(`guidance ${compactText(clause.negotiationGuidance, 160)}`);
      }

      return parts.join('; ');
    });

  const fallbackLines = Object.entries(playbook.fallbackPositions || {})
    .slice(0, 4)
    .map(([category, position]) => {
      const parts = [
        `${category}: initial \"${compactText(position.initial, 180)}\"`,
        `fallback \"${compactText(position.fallback1, 160)}\"`,
      ];

      if (position.walkaway) {
        parts.push(`walkaway \"${compactText(position.walkaway, 140)}\"`);
      }

      return parts.join('; ');
    });

  const redFlagLines = (playbook.redFlags || [])
    .slice(0, 4)
    .map(
      (flag) =>
        `${flag.category} (${flag.severity}): avoid ${compactText(flag.pattern, 140)} because ${compactText(flag.explanation, 160)}`,
    );

  return [
    `Active policy pack: ${playbook.name}`,
    playbook.description ? `Description: ${compactText(playbook.description, 240)}` : '',
    playbook.contractTypes.length > 0
      ? `Preferred contract types: ${playbook.contractTypes.join(', ')}`
      : '',
    clauseLines.length > 0 ? `Preferred clause language:\n${clauseLines.join('\n')}` : '',
    fallbackLines.length > 0 ? `Negotiation fallback positions:\n${fallbackLines.join('\n')}` : '',
    redFlagLines.length > 0 ? `Clauses to avoid or escalate:\n${redFlagLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}