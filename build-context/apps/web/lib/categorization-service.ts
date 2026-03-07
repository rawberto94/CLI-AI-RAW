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
import { queueRAGReindex } from "@/lib/rag/reindex-helper";

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
 * Get AI-extracted metadata from contract for smarter categorization
 */
async function getExtractedMetadata(
  contractId: string,
  tenantId: string
): Promise<{
  supplierName?: string;
  contractType?: string;
  totalValue?: number;
  currency?: string;
  serviceDescription?: string;
  industry?: string;
  keywords?: string[];
  parties?: string[];
  obligations?: string[];
  deliverables?: string[];
  lineOfService?: string;
}> {
  // Get contract with all extracted fields
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      supplierName: true,
      contractType: true,
      totalValue: true,
      currency: true,
      description: true,
      keywords: true,
      rawText: true,
      // Extended metadata from JSON field if available
      metadata: true,
    },
  });

  if (!contract) {
    return {};
  }

  // Get extracted artifacts (AI-generated insights)
  const artifacts = await prisma.contractArtifact.findMany({
    where: {
      contractId,
      type: {
        in: [
          'EXTRACTED_DATA', 
          'SUMMARY', 
          'KEY_TERMS', 
          'ENTITIES', 
          'OBLIGATIONS',
          'RATES',
          'FINANCIAL',
          'OVERVIEW',
          'CLAUSES',
          'INGESTION',
        ],
      },
    },
    select: { type: true, value: true },
  });

  // Parse artifacts to extract useful categorization info
  let serviceDescription = '';
  let industry = '';
  let parties: string[] = [];
  let obligations: string[] = [];
  let deliverables: string[] = [];
  let lineOfService = '';
  let extractedKeywords: string[] = [];
  let serviceTypes: string[] = [];
  let rateCategories: string[] = [];

  for (const artifact of artifacts) {
    const value = artifact.value as Record<string, any> | null;
    if (!value) continue;

    switch (artifact.type) {
      case 'EXTRACTED_DATA':
      case 'INGESTION':
        serviceDescription = serviceDescription || value.serviceDescription || value.scopeOfWork || value.description || value.summary || '';
        industry = industry || value.industry || value.sector || value.businessDomain || '';
        lineOfService = lineOfService || value.lineOfService || value.serviceType || value.category || value.contractCategory || '';
        if (Array.isArray(value.deliverables)) {
          deliverables = [...deliverables, ...value.deliverables];
        }
        if (Array.isArray(value.keywords)) {
          extractedKeywords = [...extractedKeywords, ...value.keywords];
        }
        if (Array.isArray(value.services)) {
          serviceTypes = [...serviceTypes, ...value.services.map((s: any) => typeof s === 'string' ? s : s.name || s.type || '')];
        }
        // Extract from nested structures
        if (value.contractInfo) {
          industry = industry || value.contractInfo.industry || value.contractInfo.sector || '';
          lineOfService = lineOfService || value.contractInfo.category || value.contractInfo.type || '';
        }
        if (value.analysis?.category) {
          lineOfService = lineOfService || value.analysis.category;
        }
        break;
        
      case 'OVERVIEW':
        serviceDescription = serviceDescription || value.summary || value.overview || value.description || '';
        if (value.keyHighlights) {
          extractedKeywords = [...extractedKeywords, ...Object.values(value.keyHighlights).filter(v => typeof v === 'string')];
        }
        if (value.contractType) {
          lineOfService = lineOfService || value.contractType;
        }
        break;

      case 'ENTITIES':
        if (Array.isArray(value.parties)) {
          parties = [...parties, ...value.parties.map((p: any) => typeof p === 'string' ? p : p.name || '')];
        }
        if (Array.isArray(value.organizations)) {
          parties = [...parties, ...value.organizations];
        }
        if (Array.isArray(value.vendors)) {
          parties = [...parties, ...value.vendors.map((v: any) => typeof v === 'string' ? v : v.name || '')];
        }
        break;
        
      case 'OBLIGATIONS':
        if (Array.isArray(value.obligations)) {
          obligations = [...obligations, ...value.obligations.map((o: any) => typeof o === 'string' ? o : o.description || o.text || o.obligation || '')];
        }
        if (Array.isArray(value.deliverables)) {
          deliverables = [...deliverables, ...value.deliverables.map((d: any) => typeof d === 'string' ? d : d.description || d.name || '')];
        }
        break;
        
      case 'KEY_TERMS':
      case 'CLAUSES':
        if (Array.isArray(value.terms)) {
          extractedKeywords = [...extractedKeywords, ...value.terms.map((t: any) => typeof t === 'string' ? t : t.term || t.name || '')];
        }
        if (Array.isArray(value.clauses)) {
          // Extract clause types as they indicate contract nature
          const clauseTypes = value.clauses.map((c: any) => c.type || c.category || c.name || '').filter(Boolean);
          extractedKeywords = [...extractedKeywords, ...clauseTypes];
        }
        break;
        
      case 'RATES':
        // Rate card data can indicate the type of service
        if (Array.isArray(value.rates)) {
          rateCategories = [...rateCategories, ...value.rates.map((r: any) => r.category || r.roleCategory || r.serviceType || '').filter(Boolean)];
          serviceTypes = [...serviceTypes, ...value.rates.map((r: any) => r.serviceType || r.role || '').filter(Boolean)];
        }
        if (value.serviceCategory) {
          lineOfService = lineOfService || value.serviceCategory;
        }
        break;
        
      case 'FINANCIAL':
        // Financial data may indicate industry
        if (value.paymentTerms) {
          extractedKeywords.push(value.paymentTerms);
        }
        if (value.billingType) {
          extractedKeywords.push(value.billingType);
        }
        break;
        
      case 'SUMMARY':
        if (typeof value.summary === 'string') {
          serviceDescription = serviceDescription || value.summary;
        }
        if (typeof value.contractType === 'string') {
          lineOfService = lineOfService || value.contractType;
        }
        if (Array.isArray(value.keyPoints)) {
          extractedKeywords = [...extractedKeywords, ...value.keyPoints];
        }
        break;
    }
  }

  // Also check contract metadata JSON field for additional data
  const metadata = contract.metadata as Record<string, any> | null;
  if (metadata) {
    industry = industry || metadata.industry || metadata.sector || '';
    lineOfService = lineOfService || metadata.category || metadata.serviceType || metadata.lineOfService || '';
    if (Array.isArray(metadata.tags)) {
      extractedKeywords = [...extractedKeywords, ...metadata.tags];
    }
    if (metadata.aiAnalysis?.suggestedCategory) {
      lineOfService = lineOfService || metadata.aiAnalysis.suggestedCategory;
    }
  }

  // Deduplicate and clean arrays
  const uniqueKeywords = [...new Set(extractedKeywords.filter(Boolean).map(k => k.toString().trim()))];
  const uniqueParties = [...new Set(parties.filter(Boolean).map(p => p.toString().trim()))];
  const uniqueObligations = [...new Set(obligations.filter(Boolean).map(o => o.toString().trim()))];
  const uniqueDeliverables = [...new Set(deliverables.filter(Boolean).map(d => d.toString().trim()))];
  const uniqueServiceTypes = [...new Set([...serviceTypes, ...rateCategories].filter(Boolean).map(s => s.toString().trim()))];

  // Add service types to keywords for better matching
  if (uniqueServiceTypes.length > 0) {
    extractedKeywords.push(...uniqueServiceTypes);
  }

  return {
    supplierName: contract.supplierName || undefined,
    contractType: contract.contractType || undefined,
    totalValue: contract.totalValue ? Number(contract.totalValue) : undefined,
    currency: contract.currency || undefined,
    serviceDescription: serviceDescription || contract.description || undefined,
    industry,
    keywords: [...new Set([
      ...(Array.isArray(contract.keywords) ? (contract.keywords as string[]).filter((k): k is string => typeof k === 'string') : []),
      ...uniqueKeywords,
    ])].filter(Boolean).slice(0, 30),
    parties: uniqueParties.slice(0, 10),
    obligations: uniqueObligations.slice(0, 10),
    deliverables: uniqueDeliverables.slice(0, 10),
    lineOfService: lineOfService || (uniqueServiceTypes.length > 0 ? uniqueServiceTypes[0] : ''),
  };
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

  if (artifact?.value && typeof artifact.value === 'string') {
    return artifact.value;
  }
  if (artifact?.value && typeof artifact.value === 'object' && 'content' in artifact.value) {
    return String((artifact.value as Record<string, unknown>).content);
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
    Array.isArray(contract.keywords) ? contract.keywords.join(" ") : null,
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

  const best = scores[0]!;
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
 * Build prompt for AI categorization using extracted metadata
 */
function buildCategorizationPrompt(
  text: string,
  categories: TaxonomyCategory[],
  extractedMetadata?: {
    supplierName?: string;
    contractType?: string;
    totalValue?: number;
    currency?: string;
    serviceDescription?: string;
    industry?: string;
    keywords?: string[];
    parties?: string[];
    obligations?: string[];
    deliverables?: string[];
    lineOfService?: string;
  }
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

  // Build extracted metadata section for AI context
  let metadataSection = '';
  if (extractedMetadata) {
    const metadataParts: string[] = [];
    
    if (extractedMetadata.supplierName) {
      metadataParts.push(`- Supplier/Vendor: ${extractedMetadata.supplierName}`);
    }
    if (extractedMetadata.contractType) {
      metadataParts.push(`- Contract Type: ${extractedMetadata.contractType}`);
    }
    if (extractedMetadata.totalValue && extractedMetadata.currency) {
      metadataParts.push(`- Contract Value: ${extractedMetadata.currency} ${extractedMetadata.totalValue.toLocaleString()}`);
    }
    if (extractedMetadata.lineOfService) {
      metadataParts.push(`- Line of Service: ${extractedMetadata.lineOfService}`);
    }
    if (extractedMetadata.industry) {
      metadataParts.push(`- Industry/Sector: ${extractedMetadata.industry}`);
    }
    if (extractedMetadata.serviceDescription) {
      metadataParts.push(`- Service Description: ${extractedMetadata.serviceDescription.substring(0, 500)}`);
    }
    if (extractedMetadata.parties && extractedMetadata.parties.length > 0) {
      metadataParts.push(`- Parties Involved: ${extractedMetadata.parties.join(", ")}`);
    }
    if (extractedMetadata.deliverables && extractedMetadata.deliverables.length > 0) {
      metadataParts.push(`- Key Deliverables: ${extractedMetadata.deliverables.slice(0, 5).join("; ")}`);
    }
    if (extractedMetadata.obligations && extractedMetadata.obligations.length > 0) {
      metadataParts.push(`- Key Obligations: ${extractedMetadata.obligations.slice(0, 5).join("; ")}`);
    }
    if (extractedMetadata.keywords && extractedMetadata.keywords.length > 0) {
      metadataParts.push(`- Extracted Keywords: ${extractedMetadata.keywords.join(", ")}`);
    }

    if (metadataParts.length > 0) {
      metadataSection = `
## AI-Extracted Contract Information:
${metadataParts.join("\n")}

Use the above extracted information as PRIMARY signals for categorization. The supplier name, service description, line of service, and deliverables are especially important for determining the correct category.
`;
    }
  }

  // Truncate text if too long
  const maxTextLength = 6000; // Reduced to make room for metadata
  const truncatedText =
    text.length > maxTextLength
      ? text.substring(0, maxTextLength) + "...[truncated]"
      : text;

  return `You are a contract classification expert. Analyze the following contract and categorize it into the most appropriate category.

## Available Categories:
${categoryList}
${metadataSection}
## Contract Text Sample:
${truncatedText}

## Classification Instructions:
1. **PRIORITIZE the AI-extracted information** (supplier name, service description, line of service, deliverables) over raw text
2. Match the contract to the most SPECIFIC and APPROPRIATE category based on:
   - The type of services/products being provided
   - The industry or business domain
   - The supplier/vendor's typical business area
3. Consider common category patterns:
   - Software, IT, Technology contracts → IT & Technology, IT Services
   - Consulting, Advisory services → Professional Services, Consulting
   - Marketing, Advertising, PR → Marketing & Communications
   - Legal services → Legal, Corporate Legal
   - Construction, Facilities → Facilities, Real Estate
   - Manufacturing, Equipment → Manufacturing, Industrial
   - Insurance policies → Insurance
   - HR, Staffing, Recruiting → Human Resources
4. If deliverables mention software development, cloud services, or technology → IT category
5. If deliverables mention consulting, strategy, advisory → Professional Services
6. Provide a confidence score (0-100) based on how clearly the contract fits the category

## Response Format (JSON):
{
  "category": "Category Name",
  "categoryPath": "/Parent/Child/Category",
  "confidence": 85,
  "reasoning": "Brief explanation citing specific extracted data that led to this categorization",
  "alternativeCategories": [
    {"category": "Alternative 1", "confidence": 60},
    {"category": "Alternative 2", "confidence": 45}
  ]
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Categorize using AI (OpenAI) with extracted metadata
 */
async function categorizeByAI(
  text: string,
  categories: TaxonomyCategory[],
  extractedMetadata?: {
    supplierName?: string;
    contractType?: string;
    totalValue?: number;
    currency?: string;
    serviceDescription?: string;
    industry?: string;
    keywords?: string[];
    parties?: string[];
    obligations?: string[];
    deliverables?: string[];
    lineOfService?: string;
  }
): Promise<CategorizationResult | null> {
  if (!openai) {
    return null;
  }

  const prompt = buildCategorizationPrompt(text, categories, extractedMetadata);

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
  } catch {
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

    // Get AI-extracted metadata for smarter categorization
    const extractedMetadata = await getExtractedMetadata(contractId, tenantId);

    // Track which methods were attempted for diagnostics
    const aiAvailable = !!openai;

    // Try AI categorization first (with extracted metadata for better accuracy)
    let result = await categorizeByAI(fullText, categoryTree, extractedMetadata);

    // Fallback to keyword matching (also use extracted keywords)
    if (!result) {
      // Enhance text with extracted keywords for better keyword matching
      const enhancedText = [
        fullText,
        extractedMetadata.serviceDescription,
        extractedMetadata.lineOfService,
        extractedMetadata.industry,
        ...(extractedMetadata.keywords || []),
        ...(extractedMetadata.deliverables || []),
      ].filter(Boolean).join(' ');
      
      result = await categorizeByKeywords(enhancedText, categoryTree);
    }

    if (!result) {
      // Try to find a fallback category (Other, Uncategorized, General, etc.)
      const flatCategories = flattenCategories([...categoryTree]);
      
      // Check if any categories have keywords defined
      const categoriesWithKeywords = flatCategories.filter(c => c.keywords && c.keywords.length > 0);
      
      const fallbackCategory = flatCategories.find(
        (cat) =>
          cat.name.toLowerCase() === 'other' ||
          cat.name.toLowerCase() === 'uncategorized' ||
          cat.name.toLowerCase() === 'general' ||
          cat.name.toLowerCase() === 'misc' ||
          cat.name.toLowerCase() === 'miscellaneous' ||
          cat.name.toLowerCase().includes('other')
      );

      if (fallbackCategory) {
        // Use fallback category with low confidence
        result = {
          success: true,
          contractId,
          category: fallbackCategory.name,
          categoryId: fallbackCategory.id,
          categoryPath: fallbackCategory.path,
          confidence: 20,
          method: "keyword" as const,
          alternativeCategories: flatCategories
            .filter((c) => c.id !== fallbackCategory.id)
            .slice(0, 3)
            .map((c) => ({
              category: c.name,
              categoryId: c.id,
              confidence: 10,
            })),
          reasoning: "No exact match found. Using fallback category.",
        };
      } else {
        // Build helpful error message
        let errorMsg = "Could not determine category.";
        if (!aiAvailable) {
          errorMsg += " AI not configured (OPENAI_API_KEY missing).";
        }
        if (categoriesWithKeywords.length === 0) {
          errorMsg += " No category keywords defined - add keywords in Settings → Taxonomy.";
        } else {
          errorMsg += " Consider adding an 'Other' category or more specific keywords to your taxonomy.";
        }
        
        return {
          success: false,
          contractId,
          category: null,
          categoryId: null,
          categoryPath: null,
          confidence: 0,
          method: "none",
          alternativeCategories: flatCategories.slice(0, 5).map((c) => ({
            category: c.name,
            categoryId: c.id,
            confidence: 10,
          })),
          error: errorMsg,
        };
      }
    }

    // Validate category belongs to tenant before updating
    if (result.categoryId) {
      const category = await prisma.taxonomyCategory.findFirst({
        where: { id: result.categoryId, tenantId },
      });
      if (!category) {
        return {
          success: false,
          contractId,
          category: null,
          categoryId: null,
          categoryPath: null,
          confidence: 0,
          method: "none",
          alternativeCategories: [],
          error: "Invalid category for tenant",
        };
      }
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

    // Queue RAG re-indexing when category is updated
    await queueRAGReindex({
      contractId,
      tenantId,
      reason: 'category updated via categorization service',
    });

    return {
      ...result,
      contractId,
    };
  } catch (error: unknown) {
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
