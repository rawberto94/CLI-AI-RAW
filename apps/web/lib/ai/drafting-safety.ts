export function normalizeDraftingPrompt(originalPrompt: string): string {
  // Pass-through: we no longer rewrite the user's wording. The previous
  // normalization map was paternalistic (e.g. NDA → confidentiality
  // agreement, target → objective) and surprised users by silently
  // changing what they typed. The only safety check we apply is the
  // explicit banned-words list in containsBannedWord().
  return originalPrompt.trim().replace(/\s+/g, ' ');
}

export function summarizeDraftingPromptForStrictSafety(originalPrompt: string): string {
  const normalized = normalizeDraftingPrompt(originalPrompt).toLowerCase();

  if (/\bconfidentiality agreement\b|\bnda\b|\bnon-disclosure\b/.test(normalized)) return 'a confidentiality agreement';
  if (/\bmaster services? agreement\b|\bmsa\b/.test(normalized)) return 'a master services agreement';
  if (/\bstatement of work\b|\bsow\b/.test(normalized)) return 'a statement of work';
  if (/\bconsulting\b|\bconsultancy\b|\bservices\b/.test(normalized)) return 'a services-related agreement';

  return 'a commercial contract request';
}

export function normalizeDraftingValue<T>(value: T): T {
  // Pass-through. See normalizeDraftingPrompt above for rationale.
  return value;
}

export function isAzureContentFilteredError(error: unknown): error is Error & { code?: string; status?: number } {
  const raw = error instanceof Error ? error.message : String(error);

  return /content[_ ]filter|content management policy|responsible ai/i.test(raw) ||
    (error as { code?: string } | undefined)?.code === 'content_filter' ||
    ((error as { status?: number } | undefined)?.status === 400 && /filter|content/i.test(raw));
}

/**
 * Tiny, explicit blocklist of terms we genuinely refuse to draft around.
 * Everything else \u2014 including industry jargon, acronyms, blunt B2B
 * language, contentious negotiating positions \u2014 is accepted verbatim.
 *
 * Keep this list short and obvious. If a user's prompt contains one of
 * these tokens we surface a single, plain-spoken refusal. We do NOT
 * silently rewrite their words.
 */
const BANNED_PATTERNS: RegExp[] = [
  // Child sexual abuse material
  /\b(?:cp|csam|child\s+(?:porn(?:ography)?|sexual\s+abuse))\b/i,
  // Weapons of mass destruction synthesis instructions
  /\b(?:bioweapon|nerve\s+agent|sarin|vx\s+agent|nuclear\s+weapon\s+(?:design|synthesis|build))\b/i,
  // Malware / cyberweapons
  /\b(?:ransomware\s+(?:kit|payload|builder)|zero[-\s]?day\s+exploit\s+for\s+sale)\b/i,
  // Targeted real-world violence
  /\b(?:assassinate|murder)\s+[a-z]/i,
];

export function containsBannedWord(text: string): { banned: true; reason: string } | { banned: false } {
  if (!text) return { banned: false };
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        banned: true,
        reason: 'Your request contains content we cannot draft around. Please remove it and try again.',
      };
    }
  }
  return { banned: false };
}
