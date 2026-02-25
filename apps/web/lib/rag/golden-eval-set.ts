/**
 * Golden Evaluation Test Set for RAG Quality Assessment
 *
 * 60 legal Q&A pairs organized by category with expected keyword patterns
 * that relevant chunks should contain. Used by `runBatchEvaluation()` to
 * compute ground-truth Recall@K, NDCG@K, MAP, and MRR metrics.
 *
 * Categories cover the full spectrum of contract intelligence queries a CLM
 * platform must handle for enterprise clients with 5000+ contracts.
 *
 * Each entry specifies:
 *  - query: The user's natural-language question
 *  - category: Query type for stratified evaluation
 *  - expectedKeywords: Terms that relevant chunks MUST contain (at least one)
 *  - difficulty: easy | medium | hard — for weighted scoring
 *  - notes: Optional description of what makes retrieval challenging
 */

export interface GoldenEvalEntry {
  query: string;
  category:
    | 'financial'
    | 'termination'
    | 'compliance'
    | 'obligations'
    | 'dates'
    | 'parties'
    | 'liability'
    | 'confidentiality'
    | 'ip'
    | 'governance'
    | 'renewal'
    | 'sla'
    | 'cross-contract';
  expectedKeywords: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  notes?: string;
}

export const GOLDEN_EVAL_SET: GoldenEvalEntry[] = [
  // ── Financial / Payment ─────────────────────────────────────────────────
  {
    query: 'What are the payment terms?',
    category: 'financial',
    expectedKeywords: ['payment', 'invoice', 'net', 'days', 'due'],
    difficulty: 'easy',
  },
  {
    query: 'What is the total contract value?',
    category: 'financial',
    expectedKeywords: ['value', 'amount', 'total', 'price', 'fee', 'cost'],
    difficulty: 'easy',
  },
  {
    query: 'Are there any late payment penalties or interest charges?',
    category: 'financial',
    expectedKeywords: ['late', 'penalty', 'interest', 'overdue', 'default'],
    difficulty: 'medium',
  },
  {
    query: 'What are the billing milestones and associated amounts?',
    category: 'financial',
    expectedKeywords: ['milestone', 'billing', 'deliverable', 'schedule', 'amount'],
    difficulty: 'medium',
  },
  {
    query: 'Is there a most-favored-customer pricing clause?',
    category: 'financial',
    expectedKeywords: ['favored', 'pricing', 'competitive', 'benchmark', 'mfn'],
    difficulty: 'hard',
    notes: 'MFN clauses may use varied phrasing — tests synonym expansion',
  },

  // ── Termination ─────────────────────────────────────────────────────────
  {
    query: 'What are the termination conditions?',
    category: 'termination',
    expectedKeywords: ['termination', 'terminate', 'cancel', 'end'],
    difficulty: 'easy',
  },
  {
    query: 'Can either party terminate for convenience?',
    category: 'termination',
    expectedKeywords: ['convenience', 'terminate', 'notice', 'without cause'],
    difficulty: 'medium',
  },
  {
    query: 'What happens upon contract termination? What are the wind-down obligations?',
    category: 'termination',
    expectedKeywords: ['termination', 'wind-down', 'transition', 'return', 'surviving'],
    difficulty: 'hard',
    notes: 'Multi-part query — tests query decomposition',
  },
  {
    query: 'What is the notice period required for termination?',
    category: 'termination',
    expectedKeywords: ['notice', 'days', 'period', 'written', 'termination'],
    difficulty: 'easy',
  },
  {
    query: 'Under what circumstances can the contract be terminated for cause?',
    category: 'termination',
    expectedKeywords: ['cause', 'breach', 'material', 'cure', 'default'],
    difficulty: 'medium',
  },

  // ── Compliance & Regulatory ─────────────────────────────────────────────
  {
    query: 'What are the data protection and GDPR compliance requirements?',
    category: 'compliance',
    expectedKeywords: ['data', 'protection', 'gdpr', 'privacy', 'personal', 'processing'],
    difficulty: 'medium',
  },
  {
    query: 'Are there any anti-bribery or anti-corruption provisions?',
    category: 'compliance',
    expectedKeywords: ['bribery', 'corruption', 'fcpa', 'compliance', 'ethics'],
    difficulty: 'medium',
  },
  {
    query: 'What environmental or sustainability obligations exist?',
    category: 'compliance',
    expectedKeywords: ['environmental', 'sustainability', 'esg', 'carbon', 'green'],
    difficulty: 'hard',
    notes: 'ESG clauses are newer and may use diverse terminology',
  },
  {
    query: 'Are there sanctions or export control restrictions?',
    category: 'compliance',
    expectedKeywords: ['sanctions', 'export', 'control', 'restricted', 'ofac'],
    difficulty: 'hard',
  },
  {
    query: 'What audit rights does the buyer have?',
    category: 'compliance',
    expectedKeywords: ['audit', 'inspection', 'review', 'access', 'records'],
    difficulty: 'medium',
  },

  // ── Obligations & Deliverables ──────────────────────────────────────────
  {
    query: 'List all obligations and deadlines',
    category: 'obligations',
    expectedKeywords: ['obligation', 'deadline', 'shall', 'must', 'deliverable', 'requirements'],
    difficulty: 'easy',
  },
  {
    query: 'What are the key performance indicators and reporting requirements?',
    category: 'obligations',
    expectedKeywords: ['kpi', 'performance', 'reporting', 'metric', 'measure'],
    difficulty: 'medium',
  },
  {
    query: 'What are the acceptance criteria for deliverables?',
    category: 'obligations',
    expectedKeywords: ['acceptance', 'criteria', 'deliverable', 'approval', 'review'],
    difficulty: 'medium',
  },
  {
    query: 'Does the supplier have any subcontracting restrictions?',
    category: 'obligations',
    expectedKeywords: ['subcontract', 'assign', 'delegate', 'third party', 'consent'],
    difficulty: 'medium',
  },
  {
    query: 'What training or onboarding obligations does the vendor have?',
    category: 'obligations',
    expectedKeywords: ['training', 'onboarding', 'knowledge transfer', 'support'],
    difficulty: 'hard',
  },

  // ── Dates & Timeline ────────────────────────────────────────────────────
  {
    query: 'When does this contract expire?',
    category: 'dates',
    expectedKeywords: ['expir', 'end date', 'term', 'effective', 'period'],
    difficulty: 'easy',
  },
  {
    query: 'What is the effective date of the agreement?',
    category: 'dates',
    expectedKeywords: ['effective', 'date', 'commence', 'start', 'execution'],
    difficulty: 'easy',
  },
  {
    query: 'What are the key milestone dates?',
    category: 'dates',
    expectedKeywords: ['milestone', 'date', 'schedule', 'timeline', 'deadline'],
    difficulty: 'medium',
  },
  {
    query: 'Are there any option periods or extension rights?',
    category: 'dates',
    expectedKeywords: ['option', 'extension', 'renew', 'extend', 'additional'],
    difficulty: 'medium',
  },

  // ── Parties & Assignments ───────────────────────────────────────────────
  {
    query: 'Who are the parties to this agreement?',
    category: 'parties',
    expectedKeywords: ['party', 'parties', 'between', 'company', 'organization'],
    difficulty: 'easy',
  },
  {
    query: 'Can the contract be assigned to a third party?',
    category: 'parties',
    expectedKeywords: ['assign', 'transfer', 'successor', 'novation', 'consent'],
    difficulty: 'medium',
  },
  {
    query: 'Who are the authorized representatives for notices?',
    category: 'parties',
    expectedKeywords: ['notice', 'representative', 'contact', 'address', 'attention'],
    difficulty: 'medium',
  },

  // ── Liability & Indemnification ─────────────────────────────────────────
  {
    query: 'What is the liability cap?',
    category: 'liability',
    expectedKeywords: ['liability', 'cap', 'limit', 'maximum', 'aggregate'],
    difficulty: 'easy',
  },
  {
    query: 'What are the indemnification obligations?',
    category: 'liability',
    expectedKeywords: ['indemnif', 'hold harmless', 'defend', 'losses', 'damages'],
    difficulty: 'medium',
  },
  {
    query: 'Are there any exclusions or carve-outs from the liability limitation?',
    category: 'liability',
    expectedKeywords: ['exclusion', 'carve-out', 'unlimited', 'exception', 'notwithstanding'],
    difficulty: 'hard',
    notes: 'Liability carve-outs test understanding of legal nuance',
  },
  {
    query: 'Does the contract exclude consequential damages?',
    category: 'liability',
    expectedKeywords: ['consequential', 'indirect', 'special', 'incidental', 'damages'],
    difficulty: 'medium',
  },
  {
    query: 'What insurance requirements are specified?',
    category: 'liability',
    expectedKeywords: ['insurance', 'coverage', 'policy', 'certificate', 'minimum'],
    difficulty: 'medium',
  },

  // ── Confidentiality & Data ──────────────────────────────────────────────
  {
    query: 'What are the confidentiality requirements?',
    category: 'confidentiality',
    expectedKeywords: ['confidential', 'nda', 'proprietary', 'non-disclosure', 'secret'],
    difficulty: 'easy',
  },
  {
    query: 'How long does the confidentiality obligation survive after termination?',
    category: 'confidentiality',
    expectedKeywords: ['surviving', 'confidential', 'year', 'period', 'termination'],
    difficulty: 'medium',
  },
  {
    query: 'What data handling and return/destruction requirements exist?',
    category: 'confidentiality',
    expectedKeywords: ['data', 'return', 'destruct', 'retention', 'disposal'],
    difficulty: 'hard',
  },
  {
    query: 'Are there any exceptions to the confidentiality obligations?',
    category: 'confidentiality',
    expectedKeywords: ['exception', 'exclude', 'public', 'disclosure', 'required by law'],
    difficulty: 'medium',
  },

  // ── Intellectual Property ───────────────────────────────────────────────
  {
    query: 'Who owns the intellectual property created under this contract?',
    category: 'ip',
    expectedKeywords: ['intellectual property', 'ip', 'ownership', 'work product', 'copyright'],
    difficulty: 'medium',
  },
  {
    query: 'What licenses are granted to use pre-existing IP?',
    category: 'ip',
    expectedKeywords: ['license', 'pre-existing', 'background ip', 'grant', 'use'],
    difficulty: 'hard',
  },
  {
    query: 'Are there any IP indemnification obligations?',
    category: 'ip',
    expectedKeywords: ['ip', 'indemnif', 'infringement', 'patent', 'copyright'],
    difficulty: 'hard',
    notes: 'Crosses IP and liability categories — tests graph co-retrieval',
  },

  // ── Governance & Dispute Resolution ─────────────────────────────────────
  {
    query: 'What is the governing law?',
    category: 'governance',
    expectedKeywords: ['governing law', 'jurisdiction', 'applicable law', 'venue'],
    difficulty: 'easy',
  },
  {
    query: 'What is the dispute resolution mechanism?',
    category: 'governance',
    expectedKeywords: ['dispute', 'arbitration', 'mediation', 'resolution', 'litigation'],
    difficulty: 'medium',
  },
  {
    query: 'Is there a mandatory escalation procedure before litigation?',
    category: 'governance',
    expectedKeywords: ['escalation', 'good faith', 'negotiation', 'senior management'],
    difficulty: 'hard',
  },
  {
    query: 'Are there any change control or amendment procedures?',
    category: 'governance',
    expectedKeywords: ['amendment', 'change', 'modification', 'written', 'mutual'],
    difficulty: 'medium',
  },

  // ── Renewal & Auto-Renewal ──────────────────────────────────────────────
  {
    query: 'Are there any auto-renewal clauses?',
    category: 'renewal',
    expectedKeywords: ['auto-renew', 'renewal', 'automatically', 'extend', 'opt-out'],
    difficulty: 'easy',
  },
  {
    query: 'What is the renewal notice deadline?',
    category: 'renewal',
    expectedKeywords: ['renewal', 'notice', 'deadline', 'days', 'prior'],
    difficulty: 'medium',
  },
  {
    query: 'Can pricing change upon renewal?',
    category: 'renewal',
    expectedKeywords: ['renewal', 'price', 'increase', 'adjustment', 'cpi', 'escalation'],
    difficulty: 'hard',
    notes: 'Spans renewal + financial categories',
  },

  // ── SLA & Performance ───────────────────────────────────────────────────
  {
    query: 'What are the SLA requirements?',
    category: 'sla',
    expectedKeywords: ['sla', 'service level', 'uptime', 'availability', 'response time'],
    difficulty: 'easy',
  },
  {
    query: 'What are the remedies or service credits for SLA breaches?',
    category: 'sla',
    expectedKeywords: ['credit', 'remedy', 'breach', 'penalty', 'sla'],
    difficulty: 'medium',
  },
  {
    query: 'What disaster recovery and business continuity provisions exist?',
    category: 'sla',
    expectedKeywords: ['disaster recovery', 'business continuity', 'backup', 'rto', 'rpo'],
    difficulty: 'hard',
  },

  // ── Cross-Contract / Complex Queries ────────────────────────────────────
  {
    query: 'Compare termination provisions across all active contracts',
    category: 'cross-contract',
    expectedKeywords: ['termination', 'terminate', 'notice', 'cancel'],
    difficulty: 'hard',
    notes: 'Cross-contract query — tests tenant-scoped multi-contract search',
  },
  {
    query: 'Which contracts have liability caps below $1 million?',
    category: 'cross-contract',
    expectedKeywords: ['liability', 'cap', 'limit', 'million', 'aggregate'],
    difficulty: 'hard',
    notes: 'Numeric reasoning + cross-contract filtering',
  },
  {
    query: 'Find all contracts expiring in the next 90 days',
    category: 'cross-contract',
    expectedKeywords: ['expir', 'end date', 'term', 'renew'],
    difficulty: 'hard',
    notes: 'Date-based cross-contract query — typically handled by metadata filters',
  },
  {
    query: 'What non-compete or exclusivity restrictions apply across our vendor agreements?',
    category: 'cross-contract',
    expectedKeywords: ['non-compete', 'exclusiv', 'restrict', 'covenant', 'compete'],
    difficulty: 'hard',
    notes: 'Tests legal synonym expansion + cross-contract search',
  },
  {
    query: 'Summarize all force majeure clauses and how they differ between contracts',
    category: 'cross-contract',
    expectedKeywords: ['force majeure', 'act of god', 'unforeseeable', 'pandemic', 'event'],
    difficulty: 'hard',
    notes: 'Multi-hop conceptual query across contracts',
  },

  // ── Edge Cases & Adversarial ────────────────────────────────────────────
  {
    query: 'What does "material adverse change" mean in this contract?',
    category: 'governance',
    expectedKeywords: ['material', 'adverse', 'change', 'mac', 'clause'],
    difficulty: 'hard',
    notes: 'Definitional query — tests retrieval of definitions sections',
  },
  {
    query: 'Are there any warranties or representations?',
    category: 'compliance',
    expectedKeywords: ['warrant', 'represent', 'guarantee', 'covenant', 'assurance'],
    difficulty: 'medium',
  },
  {
    query: 'What happens if there is a change of control of one of the parties?',
    category: 'governance',
    expectedKeywords: ['change of control', 'acquisition', 'merger', 'assignment'],
    difficulty: 'hard',
    notes: 'Tests understanding of corporate event clauses',
  },
  {
    query: 'Does the contract contain a severability clause?',
    category: 'governance',
    expectedKeywords: ['severab', 'invalid', 'unenforceable', 'remaining', 'provisions'],
    difficulty: 'medium',
  },
];

/**
 * Get a subset of golden evaluation entries filtered by category or difficulty.
 */
export function getGoldenEvalSubset(options?: {
  categories?: GoldenEvalEntry['category'][];
  difficulties?: GoldenEvalEntry['difficulty'][];
  maxEntries?: number;
}): GoldenEvalEntry[] {
  let entries = [...GOLDEN_EVAL_SET];

  if (options?.categories?.length) {
    entries = entries.filter(e => options.categories!.includes(e.category));
  }
  if (options?.difficulties?.length) {
    entries = entries.filter(e => options.difficulties!.includes(e.difficulty));
  }
  if (options?.maxEntries) {
    entries = entries.slice(0, options.maxEntries);
  }

  return entries;
}

/**
 * Check if a retrieved chunk matches the expected keywords for a golden entry.
 * Returns a relevance score (0-1) based on keyword overlap.
 */
export function scoreChunkAgainstGolden(
  chunkText: string,
  entry: GoldenEvalEntry,
): number {
  const lower = chunkText.toLowerCase();
  const matches = entry.expectedKeywords.filter(kw => lower.includes(kw.toLowerCase()));
  return matches.length / entry.expectedKeywords.length;
}
