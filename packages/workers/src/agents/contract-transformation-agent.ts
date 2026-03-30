/**
 * Contract Transformation Agent — Codename: MemoryKeeper 🧬
 *
 * Extracts reusable patterns from contracts for knowledge-graph enrichment.
 * Identifies clause templates, entity relationships, contract genealogy,
 * and term standardisation opportunities.
 *
 * Cluster: oracles | Handle: @memorykeeper
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentRecommendation } from './types';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface ClausePattern {
  id: string;
  category: string;
  language: string;
  frequency: number;
  isStandard: boolean;
  confidence: number;
}

interface ExtractedEntity {
  name: string;
  type: 'company' | 'person' | 'clause' | 'obligation' | 'term' | 'location' | 'date' | 'amount';
  value: string;
  confidence: number;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

interface GenealogyInfo {
  hasAmendments: boolean;
  hasRenewals: boolean;
  hasSuperseded: boolean;
  references: string[];
}

interface StandardisationSuggestion {
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
}

interface TransformationResult {
  patterns: ClausePattern[];
  entities: ExtractedEntity[];
  relationships: Relationship[];
  genealogy: GenealogyInfo;
  standardisationSuggestions: StandardisationSuggestion[];
  analysedAt: string;
}

// --------------------------------------------------------------------------
// Pattern detection (clause categories + regex)
// --------------------------------------------------------------------------

const CLAUSE_CATEGORIES: Array<{ category: string; patterns: RegExp[]; standard: string }> = [
  {
    category: 'termination',
    patterns: [/terminat\w+\s+(?:for\s+)?(?:convenience|cause|breach|material)/gi, /either\s+party\s+may\s+terminat/gi],
    standard: 'Either party may terminate upon [NOTICE_PERIOD] written notice.',
  },
  {
    category: 'liability-limitation',
    patterns: [/(?:aggregate|total|maximum)\s+liabilit/gi, /in\s+no\s+event\s+shall.{0,40}liabilit/gi],
    standard: 'Total liability shall not exceed [LIABILITY_CAP].',
  },
  {
    category: 'indemnification',
    patterns: [/indemnif\w+\s+(?:and\s+)?hold\s+harmless/gi, /shall\s+indemnif/gi],
    standard: 'Each party shall indemnify the other against third-party claims arising from its breach.',
  },
  {
    category: 'confidentiality',
    patterns: [/confidential\s+information\s+(?:means|shall|includes)/gi, /non-?\s*disclosure/gi],
    standard: 'Each party shall protect Confidential Information with the same degree of care it uses for its own.',
  },
  {
    category: 'force-majeure',
    patterns: [/force\s+majeure/gi, /acts?\s+of\s+god/gi, /beyond.{0,30}reasonable\s+control/gi],
    standard: 'Neither party shall be liable for delays caused by events beyond reasonable control.',
  },
  {
    category: 'intellectual-property',
    patterns: [/intellectual\s+property/gi, /work\s+(?:product|for\s+hire)/gi, /all\s+(?:right|title|interest)/gi],
    standard: 'All pre-existing IP remains with originating party; work product ownership as specified.',
  },
  {
    category: 'governing-law',
    patterns: [/govern(?:ed|ing)\s+by\s+(?:the\s+)?laws?\s+of/gi, /shall\s+be\s+construed\s+(?:in\s+accordance|under)/gi],
    standard: 'This Agreement shall be governed by the laws of [JURISDICTION].',
  },
  {
    category: 'assignment',
    patterns: [/(?:neither\s+party\s+)?(?:may|shall)\s+(?:not\s+)?assign/gi, /assignment.{0,40}(?:consent|approval)/gi],
    standard: 'Neither party may assign this Agreement without prior written consent.',
  },
  {
    category: 'dispute-resolution',
    patterns: [/arbitrat\w+/gi, /mediat\w+/gi, /dispute\s+resolution/gi],
    standard: 'Disputes shall be resolved through [MECHANISM] before litigation.',
  },
  {
    category: 'payment-terms',
    patterns: [/net\s+\d+/gi, /payment\s+(?:due|terms|schedule)/gi, /invoic\w+/gi],
    standard: 'Payment is due within [PAYMENT_DAYS] days of invoice receipt.',
  },
];

// --------------------------------------------------------------------------
// Entity extraction (regex-based — mirrors knowledge-graph entity types)
// --------------------------------------------------------------------------

const ENTITY_PATTERNS: Array<{ type: ExtractedEntity['type']; patterns: RegExp[] }> = [
  {
    type: 'company',
    patterns: [
      /(?:^|\s)([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*(?:\s+(?:Inc|LLC|Ltd|Corp|GmbH|AG|SA|PLC|LP|LLP))\.?)/gm,
    ],
  },
  {
    type: 'amount',
    patterns: [
      /\$\s?[\d,]+(?:\.\d{2})?/g,
      /(?:USD|EUR|GBP|CHF)\s?[\d,]+(?:\.\d{2})?/g,
    ],
  },
  {
    type: 'date',
    patterns: [
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/g,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
      /\d{4}-\d{2}-\d{2}/g,
    ],
  },
  {
    type: 'location',
    patterns: [
      /State\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /(?:County|City)\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    ],
  },
];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function extractClausePatterns(text: string): ClausePattern[] {
  const patterns: ClausePattern[] = [];
  let patIdx = 0;

  for (const cat of CLAUSE_CATEGORIES) {
    let totalMatches = 0;
    let matchedText = '';

    for (const pat of cat.patterns) {
      pat.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pat.exec(text)) !== null) {
        totalMatches++;
        if (!matchedText) {
          const start = Math.max(0, m.index - 60);
          const end = Math.min(text.length, m.index + m[0].length + 60);
          matchedText = text.slice(start, end).trim();
        }
      }
    }

    if (totalMatches > 0) {
      // Determine if the language is "standard" by checking similarity to the template
      const isStandard = cat.standard.split(' ').filter(w => w.length > 3)
        .some(w => text.toLowerCase().includes(w.toLowerCase()));

      patterns.push({
        id: `pattern-${++patIdx}`,
        category: cat.category,
        language: matchedText.slice(0, 200),
        frequency: totalMatches,
        isStandard,
        confidence: Math.min(0.95, 0.6 + totalMatches * 0.1),
      });
    }
  }

  return patterns;
}

function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const entDef of ENTITY_PATTERNS) {
    for (const pat of entDef.patterns) {
      pat.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pat.exec(text)) !== null) {
        const value = (m[1] || m[0]).trim();
        const key = `${entDef.type}:${value.toLowerCase()}`;
        if (value.length >= 2 && !seen.has(key)) {
          seen.add(key);
          entities.push({
            name: value,
            type: entDef.type,
            value,
            confidence: 0.75,
          });
        }
        if (entities.length >= 50) break; // cap to prevent runaway
      }
    }
  }

  return entities;
}

function inferRelationships(entities: ExtractedEntity[], text: string): Relationship[] {
  const relationships: Relationship[] = [];
  const companies = entities.filter(e => e.type === 'company');
  const amounts = entities.filter(e => e.type === 'amount');
  const dates = entities.filter(e => e.type === 'date');

  // Company → Amount relationships (payment obligations)
  for (const company of companies) {
    for (const amount of amounts) {
      const compIdx = text.indexOf(company.value);
      const amtIdx = text.indexOf(amount.value);
      if (compIdx >= 0 && amtIdx >= 0 && Math.abs(compIdx - amtIdx) < 300) {
        relationships.push({
          source: company.value,
          target: amount.value,
          type: 'obligates_payment',
          confidence: 0.6,
        });
      }
    }
  }

  // Company → Date relationships (timeline connections)
  for (const company of companies) {
    for (const date of dates) {
      const compIdx = text.indexOf(company.value);
      const dateIdx = text.indexOf(date.value);
      if (compIdx >= 0 && dateIdx >= 0 && Math.abs(compIdx - dateIdx) < 200) {
        relationships.push({
          source: company.value,
          target: date.value,
          type: 'effective_date',
          confidence: 0.55,
        });
        break; // one date per company to avoid duplication
      }
    }
  }

  return relationships.slice(0, 30); // cap
}

function detectGenealogy(text: string, ctx: Record<string, any>): GenealogyInfo {
  const refs: string[] = [];

  const amendmentRefs = text.match(/(?:amendment|addendum)\s+(?:no\.?\s*)?\d+/gi) || [];
  const renewalRefs = text.match(/(?:renewal|extension)\s+(?:of|to)\s+(?:the\s+)?(?:agreement|contract)/gi) || [];
  const supersedeRefs = text.match(/(?:supersed|replac|cancel)\w*\s+(?:the\s+)?(?:prior|previous|existing)/gi) || [];

  refs.push(...amendmentRefs.map(r => r.trim()));
  refs.push(...renewalRefs.map(r => r.trim()));
  refs.push(...supersedeRefs.map(r => r.trim()));

  return {
    hasAmendments: amendmentRefs.length > 0 || !!ctx.isAmendment,
    hasRenewals: renewalRefs.length > 0 || !!ctx.autoRenewalEnabled,
    hasSuperseded: supersedeRefs.length > 0,
    references: [...new Set(refs)].slice(0, 10),
  };
}

function detectStandardisationOpportunities(ctx: Record<string, any>, text: string): StandardisationSuggestion[] {
  const suggestions: StandardisationSuggestion[] = [];

  // Date format standardisation
  const usDateFormat = /\d{1,2}\/\d{1,2}\/\d{2,4}/g.test(text);
  const isoDateFormat = /\d{4}-\d{2}-\d{2}/g.test(text);
  const longDateFormat = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/g.test(text);
  const formats = [usDateFormat && 'MM/DD/YYYY', isoDateFormat && 'YYYY-MM-DD', longDateFormat && 'Month D, YYYY'].filter(Boolean);
  if (formats.length > 1) {
    suggestions.push({
      field: 'Date format',
      currentValue: formats.join(', '),
      suggestedValue: 'YYYY-MM-DD (ISO 8601)',
      reason: 'Multiple date formats detected — standardise to ISO 8601 for consistency.',
    });
  }

  // Currency format
  const hasDollarSign = /\$\s*\d/.test(text);
  const hasCurrencyCode = /(?:USD|EUR|GBP)\s*\d/.test(text);
  if (hasDollarSign && hasCurrencyCode) {
    suggestions.push({
      field: 'Currency notation',
      currentValue: 'Mixed ($ and currency codes)',
      suggestedValue: 'Use ISO 4217 currency codes (USD, EUR) throughout',
      reason: 'Inconsistent currency notation creates ambiguity in international contracts.',
    });
  }

  // Party naming
  if (ctx.clientName && ctx.supplierName) {
    const clientInText = text.includes(ctx.clientName);
    const supplierInText = text.includes(ctx.supplierName);
    if (clientInText && supplierInText) {
      // Check for inconsistent references (e.g., "Acme" vs "Acme Corp" vs "ACME Corporation")
      const clientVariants = text.match(new RegExp(ctx.clientName.split(' ')[0] + '\\w*(?:\\s+\\w+)*', 'gi')) || [];
      const uniqueVariants = [...new Set(clientVariants.map((v: string) => v.trim()))];
      if (uniqueVariants.length > 2) {
        suggestions.push({
          field: 'Party naming',
          currentValue: uniqueVariants.slice(0, 3).join(', '),
          suggestedValue: `Use defined term (e.g., "${ctx.clientName}") consistently`,
          reason: 'Multiple name variations for the same party create ambiguity.',
        });
      }
    }
  }

  return suggestions;
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class ContractTransformationAgent extends BaseAgent {
  name = 'contract-transformation-agent';
  version = '1.0.0';
  capabilities = ['contract-transformation', 'learning'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const ctx = { ...input.context, ...(input.context?.contract || {}) };
    const text: string = ctx.rawText || ctx.searchableText || ctx.contractText || '';

    logger.info({ contractId: input.contractId }, 'Extracting transformation patterns');

    if (!text || text.length < 50) {
      return {
        success: true,
        data: {
          patterns: [], entities: [], relationships: [], genealogy: { hasAmendments: false, hasRenewals: false, hasSuperseded: false, references: [] },
          standardisationSuggestions: [], analysedAt: new Date().toISOString(),
        } satisfies TransformationResult,
        confidence: 0.5,
        reasoning: 'Insufficient contract text for pattern extraction.',
      };
    }

    const patterns = extractClausePatterns(text);
    const entities = extractEntities(text);
    const relationships = inferRelationships(entities, text);
    const genealogy = detectGenealogy(text, ctx);
    const standardisationSuggestions = detectStandardisationOpportunities(ctx, text);

    const result: TransformationResult = {
      patterns,
      entities,
      relationships,
      genealogy,
      standardisationSuggestions,
      analysedAt: new Date().toISOString(),
    };

    // --- Recommendations ---
    const recommendations: AgentRecommendation[] = [];

    const customPatterns = patterns.filter(p => !p.isStandard);
    if (customPatterns.length > 0) {
      recommendations.push({
        id: `xform-rec-custom-${Date.now()}`,
        title: 'Non-standard clause language detected',
        description: `${customPatterns.length} clause(s) use non-standard language: ${customPatterns.map(p => p.category).join(', ')}. Consider standardising for consistency.`,
        category: 'process-improvement' as const,
        priority: 'medium' as const,
        confidence: 0.8,
        effort: 'medium' as const,
        timeframe: 'Next revision cycle',
        actions: [],
        reasoning: 'Standardised clause language reduces review time and improves enforceability.',
      });
    }

    if (standardisationSuggestions.length > 0) {
      recommendations.push({
        id: `xform-rec-std-${Date.now()}`,
        title: 'Formatting standardisation opportunities',
        description: `${standardisationSuggestions.length} standardisation opportunity/ies: ${standardisationSuggestions.map(s => s.field).join(', ')}.`,
        category: 'data-quality' as const,
        priority: 'low' as const,
        confidence: 0.75,
        effort: 'low' as const,
        timeframe: 'During next revision',
        actions: [],
        reasoning: 'Consistent formatting improves automated processing and reduces errors.',
      });
    }

    if (genealogy.hasAmendments || genealogy.hasRenewals || genealogy.hasSuperseded) {
      recommendations.push({
        id: `xform-rec-genealogy-${Date.now()}`,
        title: 'Contract genealogy detected',
        description: `This contract ${[
          genealogy.hasAmendments && 'references amendments',
          genealogy.hasRenewals && 'includes renewal provisions',
          genealogy.hasSuperseded && 'supersedes prior agreements',
        ].filter(Boolean).join(', ')}. Ensure related documents are linked in the system.`,
        category: 'process-improvement' as const,
        priority: 'medium' as const,
        confidence: 0.85,
        effort: 'low' as const,
        timeframe: 'Promptly',
        actions: [],
        reasoning: 'Linked contract genealogy provides full audit trail and prevents version confusion.',
      });
    }

    const confidence = this.calculateConfidence({
      dataQuality: text.length > 2000 ? 0.9 : 0.65,
      modelConfidence: 0.8,
      validationPassed: patterns.length > 0,
    });

    return {
      success: true,
      data: result,
      recommendations,
      confidence,
      reasoning: this.formatReasoning([
        `Analysed ${text.length.toLocaleString()} characters`,
        `Extracted ${patterns.length} clause pattern(s) (${customPatterns.length} non-standard)`,
        `Found ${entities.length} entities and ${relationships.length} relationships`,
        `Genealogy: amendments=${genealogy.hasAmendments}, renewals=${genealogy.hasRenewals}, superseded=${genealogy.hasSuperseded}`,
        `${standardisationSuggestions.length} standardisation suggestion(s)`,
      ]),
      metadata: {
        patternCount: patterns.length,
        entityCount: entities.length,
        relationshipCount: relationships.length,
      },
    };
  }

  protected getEventType(): 'contract_transformed' {
    return 'contract_transformed';
  }
}

export const contractTransformationAgent = new ContractTransformationAgent();
