/**
 * Cross-Encoder Reranking Service
 * 
 * Provides high-precision reranking using cross-encoder models.
 * Cross-encoders score query-document pairs jointly for better relevance.
 */

import OpenAI from 'openai';

// Types
export interface RerankResult {
  index: number;
  text: string;
  score: number;
  originalScore: number;
}

export interface RerankOptions {
  topK?: number;
  model?: 'openai' | 'cohere';
  minScore?: number;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Cross-encoder reranking using OpenAI
 * Uses GPT-4 to score relevance of each document to the query
 */
export async function crossEncoderRerank(
  query: string,
  documents: string[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { topK = 10, minScore = 0.3 } = options;
  
  if (documents.length === 0) {
    return [];
  }

  // For small sets, score all; for larger sets, use batching
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize).map((text, idx) => ({
      index: i + idx,
      text,
    })));
  }

  const allScores: RerankResult[] = [];

  for (const batch of batches) {
    try {
      const scores = await scoreBatch(query, batch);
      allScores.push(...scores);
    } catch (error) {
      console.error('Reranking batch error:', error);
      // Fallback: use original positions
      batch.forEach((doc, idx) => {
        allScores.push({
          index: doc.index,
          text: doc.text,
          score: 1 - (doc.index * 0.1), // Decaying score
          originalScore: 1 - (doc.index * 0.1),
        });
      });
    }
  }

  // Sort by score and filter
  return allScores
    .sort((a, b) => b.score - a.score)
    .filter(r => r.score >= minScore)
    .slice(0, topK);
}

/**
 * Score a batch of documents against a query
 */
async function scoreBatch(
  query: string,
  documents: { index: number; text: string }[]
): Promise<RerankResult[]> {
  // Format documents for scoring
  const docsText = documents
    .map((d, i) => `[${i + 1}] ${d.text.slice(0, 500)}...`)
    .join('\n\n');

  const prompt = `You are a relevance scoring system. Score each document's relevance to the query on a scale of 0.0 to 1.0.

Query: "${query}"

Documents:
${docsText}

Return a JSON array of scores in the format: [0.95, 0.72, 0.45, ...]
Only return the JSON array, nothing else.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a precise relevance scoring system. Always return valid JSON arrays of numbers.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content || '[]';
  
  try {
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\d.,\s]+\]/);
    const scores: number[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    return documents.map((doc, i) => ({
      index: doc.index,
      text: doc.text,
      score: scores[i] ?? 0.5,
      originalScore: 1 - (doc.index * 0.05), // Approximate original ranking
    }));
  } catch {
    console.error('Failed to parse reranking scores:', content);
    // Fallback to original ordering
    return documents.map((doc, i) => ({
      index: doc.index,
      text: doc.text,
      score: 0.5,
      originalScore: 1 - (doc.index * 0.05),
    }));
  }
}

/**
 * Lightweight reranking using embedding similarity boost
 * Faster but less accurate than cross-encoder
 */
export async function embeddingBoostRerank(
  queryEmbedding: number[],
  documents: { text: string; embedding: number[]; score: number }[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { topK = 10, minScore = 0.3 } = options;

  // Recompute similarity with refined weights
  const results = documents.map((doc, index) => {
    const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
    // Boost original retrieval score with fresh similarity calculation
    const boostedScore = (doc.score * 0.6) + (similarity * 0.4);
    
    return {
      index,
      text: doc.text,
      score: boostedScore,
      originalScore: doc.score,
    };
  });

  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => r.score >= minScore)
    .slice(0, topK);
}

/**
 * Cohere-style reranking using semantic similarity
 * Provides a balance between speed and accuracy
 */
export async function semanticRerank(
  query: string,
  documents: string[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { topK = 10, minScore = 0.3 } = options;

  // Get embeddings for query and all documents
  const allTexts = [query, ...documents];
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: allTexts,
    dimensions: 1536,
  });

  const embeddings = response.data.map(d => d.embedding);
  const queryEmbed = embeddings[0];
  const docEmbeds = embeddings.slice(1);
  
  if (!queryEmbed) {
    return [];
  }

  // Score each document
  const results = documents.map((text, index) => {
    const docEmbed = docEmbeds[index];
    const similarity = docEmbed ? cosineSimilarity(queryEmbed, docEmbed) : 0;
    return {
      index,
      text,
      score: similarity,
      originalScore: 1 - (index * 0.05),
    };
  });

  return results
    .sort((a, b) => b.score - a.score)
    .filter(r => r.score >= minScore)
    .slice(0, topK);
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Maximal Marginal Relevance (MMR) reranking
 * Balances relevance with diversity to reduce redundant results
 */
export async function mmrRerank(
  query: string,
  documents: { text: string; embedding: number[]; score: number }[],
  queryEmbedding: number[],
  options: { lambda?: number; topK?: number } = {}
): Promise<RerankResult[]> {
  const { lambda = 0.5, topK = 10 } = options;
  
  if (documents.length === 0) return [];

  const selected: RerankResult[] = [];
  const remaining = [...documents.map((d, i) => ({ ...d, index: i }))];

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const doc = remaining[i];
      if (!doc) continue;
      
      // Relevance to query
      const relevance = cosineSimilarity(queryEmbedding, doc.embedding);
      
      // Maximum similarity to already selected documents
      let maxSimToSelected = 0;
      for (const sel of selected) {
        const selDoc = documents[sel.index];
        if (selDoc) {
          const sim = cosineSimilarity(doc.embedding, selDoc.embedding);
          maxSimToSelected = Math.max(maxSimToSelected, sim);
        }
      }
      
      // MMR score = λ * relevance - (1 - λ) * maxSimToSelected
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;
      
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    if (chosen) {
      selected.push({
        index: chosen.index,
        text: chosen.text,
        score: chosen.score,
        originalScore: chosen.score,
      });
    }
  }

  return selected;
}

/**
 * Hybrid reranking combining multiple strategies
 */
export async function hybridRerank(
  query: string,
  documents: string[],
  options: RerankOptions & { useCrossEncoder?: boolean } = {}
): Promise<RerankResult[]> {
  const { useCrossEncoder = true, topK = 10 } = options;

  // For production with many documents, use semantic reranking
  // For high-stakes queries, use cross-encoder
  if (useCrossEncoder && documents.length <= 20) {
    return crossEncoderRerank(query, documents, options);
  }

  // Fall back to semantic reranking for larger sets
  return semanticRerank(query, documents, options);
}
