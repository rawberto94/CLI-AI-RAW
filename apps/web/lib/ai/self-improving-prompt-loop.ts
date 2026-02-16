/**
 * Self-Improving Prompt Loop
 *
 * Closes the feedback loop between user corrections and extraction prompts.
 * Queries learned correction patterns from the database and injects them as
 * "learned hints" into the adaptive prompt builder, so future extractions
 * benefit from past mistakes.
 *
 * Flow:
 *   User correction → continuous-learning-agent → learningRecord DB
 *   ↓ (this module reads from DB)
 *   getLearnedHints(contractType) → pattern list
 *   ↓
 *   AdaptivePromptBuilder.buildSystemPrompt is augmented with learned hints
 *   ↓
 *   Fewer extraction errors → fewer corrections → virtuous cycle
 */

// ---------------------------------------------------------------------------
// In-memory pattern cache — refreshed periodically to avoid per-request DB hits
// ---------------------------------------------------------------------------

interface LearnedPattern {
  field: string;
  contractType: string;
  commonMistake: string;
  correctApproach: string;
  occurrences: number;
  confidence: number;
}

interface PatternCache {
  patterns: LearnedPattern[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, PatternCache>();

/**
 * Try to get a Prisma client — this module can be imported from either
 * the Next.js app or the workers package.
 */
function getPrisma(): any | null {
  try {
    // Workers package
     
    const clientsDb = require('clients-db');
    const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
    return getClient();
  } catch {
    try {
      // Next.js app — dynamic import style
       
      return require('@/lib/prisma').prisma;
    } catch {
      return null;
    }
  }
}

/**
 * Fetch learned patterns from the DB (grouping extractionCorrection rows).
 * Uses the same query the continuous-learning-agent uses, but cached.
 */
async function fetchPatterns(contractType?: string): Promise<LearnedPattern[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    const where: Record<string, any> = { wasCorrect: false };
    if (contractType && contractType !== 'all') {
      where.contractType = contractType;
    }

    const groups = await prisma.extractionCorrection.groupBy({
      by: ['fieldName', 'contractType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 30,
    });

    const patterns: LearnedPattern[] = [];

    for (const g of groups) {
      if (g._count.id < 2) continue; // need at least 2 occurrences

      // Grab an example to know what the common mistake / correct value look like
      const example = await prisma.extractionCorrection.findFirst({
        where: { fieldName: g.fieldName, contractType: g.contractType || undefined, wasCorrect: false },
        orderBy: { createdAt: 'desc' },
        select: { originalValue: true, correctedValue: true },
      });

      patterns.push({
        field: g.fieldName,
        contractType: g.contractType || 'all',
        commonMistake: String(example?.originalValue ?? 'unknown'),
        correctApproach: String(example?.correctedValue ?? 'unknown'),
        occurrences: g._count.id,
        confidence: Math.min(0.95, 0.5 + g._count.id * 0.05),
      });
    }

    return patterns;
  } catch {
    // Table may not exist yet in dev – degrade gracefully
    return [];
  }
}

/**
 * Get learned hints for a contract type (cached).
 * Returns a formatted string block that can be appended to the system prompt.
 */
export async function getLearnedHints(contractType?: string): Promise<string> {
  const cacheKey = contractType || '__all__';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return formatHints(cached.patterns);
  }

  const patterns = await fetchPatterns(contractType);
  cache.set(cacheKey, { patterns, fetchedAt: Date.now() });
  return formatHints(patterns);
}

/**
 * Get raw patterns (for programmatic use).
 */
export async function getLearnedPatterns(contractType?: string): Promise<LearnedPattern[]> {
  const cacheKey = contractType || '__all__';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.patterns;
  }

  const patterns = await fetchPatterns(contractType);
  cache.set(cacheKey, { patterns, fetchedAt: Date.now() });
  return patterns;
}

/**
 * Invalidate the cache (call after new corrections are recorded).
 */
export function invalidateLearnedHintsCache(contractType?: string): void {
  if (contractType) {
    cache.delete(contractType);
    cache.delete('__all__');
  } else {
    cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatHints(patterns: LearnedPattern[]): string {
  if (patterns.length === 0) return '';

  const lines = patterns.map(p =>
    `- Field "${p.field}": Do NOT extract as "${p.commonMistake}". ` +
    `The correct value pattern is "${p.correctApproach}" ` +
    `(learned from ${p.occurrences} corrections, ${Math.round(p.confidence * 100)}% confidence).`
  );

  return `

## LEARNED EXTRACTION IMPROVEMENTS
The following corrections have been learned from user feedback. Apply them:
${lines.join('\n')}
`;
}
