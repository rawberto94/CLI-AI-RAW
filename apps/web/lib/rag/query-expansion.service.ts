/**
 * Multi-Query Expansion Service
 * 
 * Generates multiple query variations to improve recall.
 * Uses HyDE (Hypothetical Document Embeddings) and query rewriting.
 */

import OpenAI from 'openai';

// Types
export interface QueryExpansion {
  original: string;
  variations: string[];
  hypotheticalAnswer?: string;
  keywords: string[];
  intent: 'search' | 'question' | 'comparison' | 'extraction';
}

export interface ExpansionOptions {
  numVariations?: number;
  useHyDE?: boolean;
  extractKeywords?: boolean;
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate multiple query variations for better recall
 */
export async function expandQuery(
  query: string,
  options: ExpansionOptions = {}
): Promise<QueryExpansion> {
  const {
    numVariations = 3,
    useHyDE = true,
    extractKeywords = true,
  } = options;

  const expansion: QueryExpansion = {
    original: query,
    variations: [],
    keywords: [],
    intent: detectQueryIntent(query),
  };

  try {
    // Generate query variations
    const variationsPromise = generateQueryVariations(query, numVariations);
    
    // Generate hypothetical answer (HyDE) for better semantic matching
    const hydePromise = useHyDE
      ? generateHypotheticalAnswer(query)
      : Promise.resolve(undefined);
    
    // Extract keywords
    const keywordsPromise = extractKeywords
      ? extractQueryKeywords(query)
      : Promise.resolve([]);

    const [variations, hypotheticalAnswer, keywords] = await Promise.all([
      variationsPromise,
      hydePromise,
      keywordsPromise,
    ]);

    expansion.variations = variations;
    expansion.hypotheticalAnswer = hypotheticalAnswer;
    expansion.keywords = keywords;

  } catch (error) {
    console.error('Query expansion error:', error);
    // Fallback: return original query with basic variations
    expansion.variations = [
      query,
      query.toLowerCase(),
      query.replace(/\?$/, ''),
    ];
    expansion.keywords = query.split(' ').filter(w => w.length > 3);
  }

  return expansion;
}

/**
 * Generate query variations using GPT
 */
async function generateQueryVariations(
  query: string,
  numVariations: number
): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a search query optimizer for legal contract documents. Generate ${numVariations} alternative phrasings of the user's query that would help find relevant contract clauses. Focus on:
1. Different terminology (legal vs business terms)
2. Different phrasings (question vs statement)
3. More specific or more general versions

Return ONLY a JSON array of strings.`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content || '[]';
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const variations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return [query, ...variations.slice(0, numVariations)];
  } catch {
    return [query];
  }
}

/**
 * Generate a hypothetical answer (HyDE technique)
 * Creates what an ideal document passage might look like
 */
async function generateHypotheticalAnswer(query: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are generating hypothetical contract text that would answer the user's question. Write a short, realistic contract clause (2-3 sentences) that directly addresses the query. This will be used to find similar real clauses.`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
    temperature: 0.5,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Extract important keywords from the query
 */
async function extractQueryKeywords(query: string): Promise<string[]> {
  // Quick extraction using patterns
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
    'what', 'when', 'where', 'who', 'which', 'how', 'why', 'this', 'that',
    'these', 'those', 'there', 'here', 'to', 'for', 'with', 'by', 'at',
    'in', 'on', 'of', 'from', 'about', 'into', 'through', 'during',
    'find', 'show', 'me', 'all', 'any', 'contract', 'contracts', 'clause',
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Also extract quoted phrases
  const quotedPhrases = query.match(/"([^"]+)"/g) || [];
  const phrases = quotedPhrases.map(p => p.replace(/"/g, ''));

  return [...new Set([...words, ...phrases])];
}

/**
 * Detect the intent of the query
 */
function detectQueryIntent(query: string): QueryExpansion['intent'] {
  const q = query.toLowerCase();

  if (q.includes('compare') || q.includes('difference') || q.includes('vs') || q.includes('between')) {
    return 'comparison';
  }
  
  if (q.includes('extract') || q.includes('list') || q.includes('all') || q.includes('find all')) {
    return 'extraction';
  }
  
  if (q.includes('?') || q.startsWith('what') || q.startsWith('how') || q.startsWith('when') || q.startsWith('where') || q.startsWith('why')) {
    return 'question';
  }

  return 'search';
}

/**
 * Expand query for specific contract search
 */
export async function expandContractQuery(
  query: string,
  contractContext?: {
    type?: string;
    supplier?: string;
    industry?: string;
  }
): Promise<QueryExpansion> {
  const baseExpansion = await expandQuery(query);

  // Add context-specific variations
  if (contractContext) {
    const contextVariations: string[] = [];
    
    if (contractContext.type) {
      contextVariations.push(`${query} in ${contractContext.type}`);
    }
    
    if (contractContext.supplier) {
      contextVariations.push(`${query} with ${contractContext.supplier}`);
    }

    baseExpansion.variations = [...baseExpansion.variations, ...contextVariations];
  }

  return baseExpansion;
}

/**
 * Generate synonyms for legal terms
 */
export function getLegalSynonyms(term: string): string[] {
  const synonymMap: Record<string, string[]> = {
    termination: ['cancellation', 'ending', 'discontinuation', 'cessation'],
    liability: ['responsibility', 'obligation', 'accountability', 'exposure'],
    indemnification: ['compensation', 'reimbursement', 'indemnity', 'hold harmless'],
    warranty: ['guarantee', 'assurance', 'representation', 'promise'],
    breach: ['violation', 'default', 'non-compliance', 'infringement'],
    confidential: ['proprietary', 'secret', 'private', 'sensitive'],
    payment: ['compensation', 'remuneration', 'fee', 'consideration'],
    renewal: ['extension', 'continuation', 'rollover'],
    dispute: ['controversy', 'disagreement', 'conflict', 'claim'],
    assignment: ['transfer', 'delegation', 'conveyance'],
    force_majeure: ['act of god', 'unforeseeable circumstances', 'extraordinary event'],
    intellectual_property: ['IP', 'patents', 'copyrights', 'trademarks', 'trade secrets'],
  };

  const lowerTerm = term.toLowerCase();
  
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (lowerTerm.includes(key) || synonyms.some(s => lowerTerm.includes(s))) {
      return synonyms;
    }
  }

  return [];
}

/**
 * Chain-of-thought query decomposition
 * Breaks complex queries into sub-queries
 */
export async function decomposeQuery(query: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a legal research assistant. Break down complex legal queries into simpler sub-queries that can be searched independently. Return a JSON array of 2-4 focused sub-queries.

Example:
Input: "What are the termination rights and notice periods for supplier contracts signed in 2023?"
Output: ["termination rights supplier contracts", "notice period requirements", "contracts signed 2023 supplier"]`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content || '[]';
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [query];
  } catch {
    return [query];
  }
}
