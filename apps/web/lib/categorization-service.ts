/**
 * Contract Categorization Service
 * 
 * AI-powered automatic categorization of contracts using client-specific taxonomy.
 * Supports multi-tenant isolation and hierarchical categories.
 * 
 * Features:
 * - Uses tenant's custom taxonomy for categorization
 * - Extracts keywords and matches against category keywords
 * - AI-powered categorization using OpenAI
 * - Confidence scoring for categorization results
 * - Bulk categorization support
 */

import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai-client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TaxonomyCategory {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  level: number;
  path: string;
  keywords: string[];
  aiClassificationPrompt?: string | null;
  children?: TaxonomyCategory[];
}

export interface CategorizationResult {
  success: boolean;
  contractId: string;
  category: string | null;
  categoryId: string | null;
  categoryPath: string | null;
  confidence: number;
  method: "ai" | "keyword" | "manual" | "none";
  alternativeCategories: Array<{
    category: string;
    categoryId: string;
    confidence: number;
  }>;
  reasoning?: string;
  error?: string;
}

export interface CategorizationInput {
  contractId: string;
  tenantId: string;
  contractText?: string;
  title?: string;
  description?: string;
  existingKeywords?: string[];
  forceRecategorize?: boolean;
}

export interface BulkCategorizationResult {
  success: boolean;
  total: number;
  categorized: number;
  failed: number;
  results: CategorizationResult[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Flatten hierarchical categories for easier processing
 */
function flattenCategories(
  categories: TaxonomyCategory[],
  result: TaxonomyCategory[] = []
): TaxonomyCategory[] {
  for (const cat of categories) {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      flattenCategories(cat.children, result);
    }
  }
  return result;
}

/**
 * Build category tree from flat list
 */
function buildCategoryTree(
  categories: TaxonomyCategory[],
  parentId: string | null = null
): TaxonomyCategory[] {
  return categories
    .filter((cat) => cat.parentId === parentId)
    .map((cat) => ({
      ...cat,
      children: buildCategoryTree(categories, cat.id),
    }));
}

/**
 * Calculate keyword match score between text and category keywords
 */
function calculateKeywordScore(
  text: string,
  keywords: string[]
): { score: number; matchedKeywords: string[] } {
  if (!text || keywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }

  const normalizedText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let totalScore = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    
    // Exact match gets higher score
    if (normalizedText.includes(normalizedKeyword)) {
      matchedKeywords.push(keyword);
      // Longer keywords are more specific, so they get higher scores
      totalScore += 1 + (keyword.length / 20);
    }
  }

  // Normalize score based on number of keywords
  const normalizedScore = keywords.length > 0 
    ? Math.min(totalScore / keywords.length, 1) 
    : 0;

  return { score: normalizedScore, matchedKeywords };
}

/**
 * Get contract text for categorization
 */
async function getContractText(
  contractId: string,
  tenantId: string
): Promise<string> {
  // First try to get from artifacts (rawText)
  const artifact = await prisma.contractArtifact.findFirst({
    where: {
      contractId,
      OR: [{ type: "RAW_TEXT" }, { type: "MARKDOWN" }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (artifact?.content) {
    return artifact.content;
  }

  // Fallback to contract metadata
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      contractTitle: true,
      description: true,
      rawText: true,
      keywords: true,
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  // Combine available text
  const parts = [
    contract.contractTitle,
    contract.description,
    contract.rawText,
    contract.keywords?.join(" "),
  ].filter(Boolean);

  return parts.join("\n\n");
}

// ============================================================================
// KEYWORD-BASED CATEGORIZATION
// ============================================================================

/**
 * Categorize using keyword matching
 */
async function categorizeByKeywords(
  text: string,
  categories: TaxonomyCategory[]
): Promise<CategorizationResult | null> {
  const flatCategories = flattenCategories([...categories]);
  const scores: Array<{
    category: TaxonomyCategory;
    score: number;
    matchedKeywords: string[];
  }> = [];

  for (const cat of flatCategories) {
    if (cat.keywords && cat.keywords.length > 0) {
      const { score, matchedKeywords } = calculateKeywordScore(text, cat.keywords);
      if (score > 0) {
        scores.push({ category: cat, score, matchedKeywords });
      }
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return null;
  }

  const best = scores[0];
  const alternatives = scores.slice(1, 4).map((s) => ({
    category: s.category.name,
    categoryId: s.category.id,
    confidence: Math.round(s.score * 100),
  }));

  return {
    success: true,
    contractId: "",
    category: best.category.name,
    categoryId: best.category.id,
    categoryPath: best.category.path,
    confidence: Math.round(best.score * 100),
    method: "keyword",
    alternativeCategories: alternatives,
    reasoning: `Matched keywords: ${best.matchedKeywords.join(", ")}`,
  };
}

// ============================================================================
// AI-BASED CATEGORIZATION
// ============================================================================

/**
 * Build prompt for AI categorization
 */
function buildCategorizationPrompt(
  text: string,
  categories: TaxonomyCategory[]
): string {
  const flatCategories = flattenCategories([...categories]);
  
  // Build category list with descriptions
  const categoryList = flatCategories
    .map((cat) => {
      const parts = [`- ${cat.name} (path: ${cat.path})`];
      if (cat.description) {
        parts.push(`  Description: ${cat.description}`);
      }
      if (cat.keywords && cat.keywords.length > 0) {
        parts.push(`  Keywords: ${cat.keywords.join(", ")}`);
      }
      if (cat.aiClassificationPrompt) {
        parts.push(`  Classification hint: ${cat.aiClassificationPrompt}`);
      }
      return parts.join("\n");
    })
    .join("\n\n");

  // Truncate text if too long
  const maxTextLength = 8000;
  const truncatedText =
    text.length > maxTextLength
      ? text.substring(0, maxTextLength) + "...[truncated]"
      : text;

  return `You are a contract classification expert. Analyze the following contract text and categorize it into one of the provided categories.

## Available Categories:
${categoryList}

## Contract Text:
${truncatedText}

## Instructions:
1. Read the contract text carefully
2. Consider the subject matter, parties involved, and contractual obligations
3. Match the contract to the most appropriate category from the list above
4. If the contract could fit multiple categories, choose the most specific one
5. Provide a confidence score (0-100) for your categorization
6. List up to 3 alternative categories if applicable

## Response Format (JSON):
{
  "category": "Category Name",
  "categoryPath": "/Parent/Child/Category",
  "confidence": 85,
  "reasoning": "Brief explanation of why this category was chosen",
  "alternativeCategories": [
    {"category": "Alternative 1", "confidence": 60},
    {"category": "Alternative 2", "confidence": 45}
  ]
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Categorize using AI (OpenAI)
 */
async function categorizeByAI(
  text: string,
  categories: TaxonomyCategory[]
): Promise<CategorizationResult | null> {
  if (!openai) {
    console.warn("OpenAI client not initialized, skipping AI categorization");
    return null;
  }

  const prompt = buildCategorizationPrompt(text, categories);

  try {
    const response = await openai.chat({
      messages: [
        {
          role: "system",
          content:
            "You are a contract classification expert. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Find matching category
    const flatCategories = flattenCategories([...categories]);
    const matchedCategory = flatCategories.find(
      (cat) =>
        cat.name.toLowerCase() === parsed.category?.toLowerCase() ||
        cat.path === parsed.categoryPath
    );

    if (!matchedCategory) {
      // Try fuzzy match
      const fuzzyMatch = flatCategories.find((cat) =>
        cat.name.toLowerCase().includes(parsed.category?.toLowerCase() || "") ||
        parsed.category?.toLowerCase().includes(cat.name.toLowerCase())
      );

      if (fuzzyMatch) {
        return {
          success: true,
          contractId: "",
          category: fuzzyMatch.name,
          categoryId: fuzzyMatch.id,
          categoryPath: fuzzyMatch.path,
          confidence: Math.round(parsed.confidence * 0.8), // Reduce confidence for fuzzy match
          method: "ai",
          alternativeCategories:
            parsed.alternativeCategories?.slice(0, 3).map((alt: any) => ({
              category: alt.category,
              categoryId: flatCategories.find(
                (c) => c.name.toLowerCase() === alt.category?.toLowerCase()
              )?.id || "",
              confidence: alt.confidence || 0,
            })) || [],
          reasoning: parsed.reasoning,
        };
      }

      throw new Error(`Category "${parsed.category}" not found in taxonomy`);
    }

    return {
      success: true,
      contractId: "",
      category: matchedCategory.name,
      categoryId: matchedCategory.id,
      categoryPath: matchedCategory.path,
      confidence: parsed.confidence || 75,
      method: "ai",
      alternativeCategories:
        parsed.alternativeCategories?.slice(0, 3).map((alt: any) => ({
          category: alt.category,
          categoryId:
            flatCategories.find(
              (c) => c.name.toLowerCase() === alt.category?.toLowerCase()
            )?.id || "",
          confidence: alt.confidence || 0,
        })) || [],
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error("AI categorization error:", error);
    return null;
  }
}

// ============================================================================
// MAIN CATEGORIZATION FUNCTIONS
// ============================================================================

/**
 * Categorize a single contract
 */
export async function categorizeContract(
  input: CategorizationInput
): Promise<CategorizationResult> {
  const { contractId, tenantId, forceRecategorize = false } = input;

  try {
    // Check if already categorized
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        category: true,
        categoryL1: true,
        categoryL2: true,
        procurementCategoryId: true,
      },
    });

    if (!contract) {
      return {
        success: false,
        contractId,
        category: null,
        categoryId: null,
        categoryPath: null,
        confidence: 0,
        method: "none",
        alternativeCategories: [],
        error: "Contract not found",
      };
    }

    // Skip if already categorized and not forcing
    if (contract.category && !forceRecategorize) {
      return {
        success: true,
        contractId,
        category: contract.category,
        categoryId: null,
        categoryPath: null,
        confidence: 100,
        method: "manual",
        alternativeCategories: [],
        reasoning: "Already categorized",
      };
    }

    // Get tenant's taxonomy
    const taxonomyCategories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });

    if (taxonomyCategories.length === 0) {
      return {
        success: false,
        contractId,
        category: null,
        categoryId: null,
        categoryPath: null,
        confidence: 0,
        method: "none",
        alternativeCategories: [],
        error: "No taxonomy categories defined for tenant",
      };
    }

    // Build category tree
    const categoryTree = buildCategoryTree(
      taxonomyCategories.map((cat) => ({
        ...cat,
        keywords: cat.keywords || [],
      }))
    );

    // Get contract text
    const contractText =
      input.contractText || (await getContractText(contractId, tenantId));

    const fullText = [input.title, input.description, contractText]
      .filter(Boolean)
      .join("\n\n");

    if (!fullText) {
      return {
        success: false,
        contractId,
        category: null,
        categoryId: null,
        categoryPath: null,
        confidence: 0,
        method: "none",
        alternativeCategories: [],
        error: "No text available for categorization",
      };
    }

    // Try AI categorization first
    let result = await categorizeByAI(fullText, categoryTree);

    // Fallback to keyword matching
    if (!result) {
      result = await categorizeByKeywords(fullText, categoryTree);
    }

    if (!result) {
      return {
        success: false,
        contractId,
        category: null,
        categoryId: null,
        categoryPath: null,
        confidence: 0,
        method: "none",
        alternativeCategories: [],
        error: "Could not categorize contract",
      };
    }

    // Update contract with category
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        category: result.category,
        categoryL1: result.categoryPath?.split("/")[1] || result.category,
        categoryL2: result.categoryPath?.split("/")[2] || null,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Contract categorized:", {
      contractId,
      category: result.category,
      confidence: result.confidence,
      method: result.method,
    });

    return {
      ...result,
      contractId,
    };
  } catch (error) {
    console.error("Categorization error:", error);
    return {
      success: false,
      contractId,
      category: null,
      categoryId: null,
      categoryPath: null,
      confidence: 0,
      method: "none",
      alternativeCategories: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Categorize multiple contracts
 */
export async function categorizeContracts(
  contractIds: string[],
  tenantId: string,
  options: { forceRecategorize?: boolean; batchSize?: number } = {}
): Promise<BulkCategorizationResult> {
  const { forceRecategorize = false, batchSize = 5 } = options;
  const results: CategorizationResult[] = [];
  let categorized = 0;
  let failed = 0;

  // Process in batches to avoid overwhelming the AI
  for (let i = 0; i < contractIds.length; i += batchSize) {
    const batch = contractIds.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((contractId) =>
        categorizeContract({
          contractId,
          tenantId,
          forceRecategorize,
        })
      )
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.success && result.category) {
        categorized++;
      } else {
        failed++;
      }
    }

    // Add delay between batches to respect rate limits
    if (i + batchSize < contractIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    success: failed === 0,
    total: contractIds.length,
    categorized,
    failed,
    results,
  };
}

/**
 * Get suggested categories for a text (without updating contract)
 */
export async function suggestCategories(
  text: string,
  tenantId: string
): Promise<{
  suggestions: Array<{
    category: string;
    categoryId: string;
    categoryPath: string;
    confidence: number;
    method: "ai" | "keyword";
  }>;
}> {
  // Get tenant's taxonomy
  const taxonomyCategories = await prisma.taxonomyCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
  });

  if (taxonomyCategories.length === 0) {
    return { suggestions: [] };
  }

  const categoryTree = buildCategoryTree(
    taxonomyCategories.map((cat) => ({
      ...cat,
      keywords: cat.keywords || [],
    }))
  );

  const suggestions: Array<{
    category: string;
    categoryId: string;
    categoryPath: string;
    confidence: number;
    method: "ai" | "keyword";
  }> = [];

  // Try AI first
  const aiResult = await categorizeByAI(text, categoryTree);
  if (aiResult && aiResult.category) {
    suggestions.push({
      category: aiResult.category,
      categoryId: aiResult.categoryId || "",
      categoryPath: aiResult.categoryPath || "",
      confidence: aiResult.confidence,
      method: "ai",
    });

    // Add alternatives
    for (const alt of aiResult.alternativeCategories) {
      const cat = taxonomyCategories.find((c) => c.id === alt.categoryId);
      if (cat) {
        suggestions.push({
          category: alt.category,
          categoryId: alt.categoryId,
          categoryPath: cat.path,
          confidence: alt.confidence,
          method: "ai",
        });
      }
    }
  }

  // Add keyword matches if not enough suggestions
  if (suggestions.length < 5) {
    const keywordResult = await categorizeByKeywords(text, categoryTree);
    if (keywordResult && keywordResult.category) {
      // Don't add duplicates
      if (!suggestions.some((s) => s.category === keywordResult.category)) {
        suggestions.push({
          category: keywordResult.category,
          categoryId: keywordResult.categoryId || "",
          categoryPath: keywordResult.categoryPath || "",
          confidence: keywordResult.confidence,
          method: "keyword",
        });
      }

      for (const alt of keywordResult.alternativeCategories) {
        if (!suggestions.some((s) => s.category === alt.category)) {
          const cat = taxonomyCategories.find((c) => c.id === alt.categoryId);
          if (cat) {
            suggestions.push({
              category: alt.category,
              categoryId: alt.categoryId,
              categoryPath: cat.path,
              confidence: alt.confidence,
              method: "keyword",
            });
          }
        }
      }
    }
  }

  // Sort by confidence and limit to 5
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return { suggestions: suggestions.slice(0, 5) };
}
