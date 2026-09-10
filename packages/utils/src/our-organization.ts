/** Home-party name for analysis: Settings first, then tenant name. Never invent. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstNonEmptyString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

export function pickOurOrganization(input: {
  settings?: unknown;
  tenantName?: string | null;
}): { name: string; aliases: string[] } | null {
  const root = isRecord(input.settings) ? input.settings : {};
  const system = isRecord(root.system) ? root.system : {};
  const name = firstNonEmptyString(
    root.ourOrganization,
    system.ourOrganization,
    input.tenantName,
  );
  if (!name) return null;
  const aliases = [
    ...stringList(root.ourOrganizationAliases),
    ...stringList(system.ourOrganizationAliases),
  ];
  return { name, aliases };
}

/** Prompt block so analysis is judged from our side. */
export function ourOrganizationPromptBlock(org?: { name: string; aliases?: string[] } | null): string {
  const name = org?.name?.trim();
  if (!name) return '';
  const aliasPart = org?.aliases?.length ? ` (aliases: ${org.aliases.join(', ')})` : '';
  return `OUR ORGANIZATION: ${name}${aliasPart}
Identify which named party is us versus the counterparty. Judge favorability, obligations, risk, and compliance from our side.`;
}
