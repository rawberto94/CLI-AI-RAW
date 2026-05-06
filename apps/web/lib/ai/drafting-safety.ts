export function normalizeDraftingPrompt(originalPrompt: string): string {
  let normalized = originalPrompt.trim();

  for (const [pattern, replacement] of DRAFTING_PROMPT_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

export function summarizeDraftingPromptForStrictSafety(originalPrompt: string): string {
  const normalized = normalizeDraftingPrompt(originalPrompt).toLowerCase();

  if (/\bconfidentiality agreement\b/.test(normalized)) return 'a confidentiality agreement';
  if (/\bmaster services? agreement\b|\bmsa\b/.test(normalized)) return 'a master services agreement';
  if (/\bstatement of work\b|\bsow\b/.test(normalized)) return 'a statement of work';
  if (/\bconsulting\b|\bservices\b/.test(normalized)) return 'a services-related agreement';

  return 'a commercial contract request';
}

export function normalizeDraftingValue<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizeDraftingPrompt(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeDraftingValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, normalizeDraftingValue(entryValue)]),
    ) as T;
  }

  return value;
}

export function isAzureContentFilteredError(error: unknown): error is Error & { code?: string; status?: number } {
  const raw = error instanceof Error ? error.message : String(error);

  return /content[_ ]filter|content management policy|responsible ai/i.test(raw) ||
    (error as { code?: string } | undefined)?.code === 'content_filter' ||
    ((error as { status?: number } | undefined)?.status === 400 && /filter|content/i.test(raw));
}

const DRAFTING_PROMPT_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\bbody\s+lease\b/gi, 'consultant secondment'],
  [/\bbody\s+shopping\b/gi, 'staff augmentation'],
  [/\bkill\s+fee\b/gi, 'early termination fee'],
  [/\bhit\s+list\b/gi, 'shortlist'],
  [/\btarget\b/gi, 'objective'],
  [/\bNDAs\b/g, 'confidentiality agreements'],
  [/\bNDA\b/g, 'confidentiality agreement'],
  [/\bnon-disclosure agreement\b/gi, 'confidentiality agreement'],
  [/\bconsultancy\b/gi, 'consulting'],
  [/\bDisclosing Party\b/gi, 'sharing party'],
  [/\bReceiving Party\b/gi, 'recipient party'],
];