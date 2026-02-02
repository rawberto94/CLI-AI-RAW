/**
 * Contract Categorization Worker
 * 
 * Background worker that categorizes contracts using AI.
 * Runs after OCR/artifact generation to classify contracts.
 * 
 * Features:
 * - Multi-dimensional categorization
 * - Confidence scoring
 * - Auto-apply high-confidence results
 * - Queue low-confidence for review
 */

// Use any for Job type due to cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any; updateProgress: (progress: number | object) => Promise<void> };
import { Worker } from "bullmq";
import pino from "pino";

import { getTraceContextFromJobData } from './observability/trace';
import { ensureProcessingJob, updateStep, assertRetryableReady } from './workflow/processing-job';
import { RetryableError } from './utils/errors';
import { sha256 } from './utils/hash';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';

// ============================================================================
// TYPES
// ============================================================================

export interface CategorizationJobData {
  contractId: string;
  tenantId: string;
  /** Force re-categorization even if already categorized */
  forceRecategorize?: boolean;
  /** Auto-apply high-confidence results */
  autoApply?: boolean;
  /** Minimum confidence for auto-apply */
  autoApplyThreshold?: number;
  /** Priority of categorization */
  priority?: "high" | "normal" | "low";
  /** Source that triggered categorization */
  source?: "upload" | "manual" | "bulk" | "scheduled";
  /** Correlation ID propagated across worker pipeline */
  traceId?: string;
  /** Optional request correlation from API layer */
  requestId?: string;
}

export interface CategorizationResult {
  success: boolean;
  contractId: string;
  contractType?: string;
  industry?: string;
  riskLevel?: string;
  complexity?: number;
  overallConfidence: number;
  autoApplied: boolean;
  processingTimeMs: number;
  errors?: string[];
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const CATEGORIZATION_QUEUE = "contract-categorization";

export const CATEGORIZATION_CONFIG = {
  name: CATEGORIZATION_QUEUE,
  concurrency: 10,
  limiter: {
    max: 60,
    duration: 60000, // 60 per minute
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 3000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60,
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 60 * 60,
    },
  },
};

// ============================================================================
// WORKER FUNCTION
// ============================================================================

/**
 * Process a categorization job
 */
export async function processCategorizationJob(
  job: Job<CategorizationJobData>
): Promise<CategorizationResult> {
  const {
    contractId,
    tenantId,
    forceRecategorize = false,
    autoApply = true,
    autoApplyThreshold: jobThreshold,
    source = "upload",
  } = job.data;

  const startTime = Date.now();
  const errors: string[] = [];
  const trace = getTraceContextFromJobData(job.data);

  try {
    await job.updateProgress(5);

    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    await updateStep({
      tenantId,
      contractId,
      step: 'categorization.run',
      status: 'running',
      progress: 5,
      currentStep: 'categorization.run',
    });

    // Dynamic imports
    const { AIContractCategorizer } = await import("@/lib/ai/contract-categorizer");
    const { prisma } = await import("@/lib/prisma");
    
    // Get tenant extraction settings for configurable thresholds
    const tenantConfig = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { extractionSettings: true },
    });
    
    const extractionSettings = (tenantConfig?.extractionSettings as Record<string, unknown>) || {};
    const tenantThreshold = (extractionSettings.contractTypeConfidenceThreshold as number) ?? 0.75;
    const tenantAutoApply = (extractionSettings.autoApplyContractType as boolean) ?? true;
    
    // Use job threshold if provided, otherwise use tenant settings
    const autoApplyThreshold = jobThreshold ?? tenantThreshold;

    // Get contract
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        rawText: true,
        status: true,
        contractType: true,
        category: true,
        metadata: true,
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    assertRetryableReady({
      status: contract.status,
      message: `Contract status is ${contract.status}, waiting for processing to complete`,
    });

    await job.updateProgress(10);

    const rawTextHash = contract.rawText ? sha256(contract.rawText) : undefined;

    // Idempotency: if we already categorized the same rawText, skip.
    if (!forceRecategorize && rawTextHash) {
      const existingMeta = (contract.metadata as any) ?? {};
      const prevHash = existingMeta?._categorization?.rawTextHash as string | undefined;
      if (prevHash && prevHash === rawTextHash) {
        await updateStep({
          tenantId,
          contractId,
          step: 'categorization.run',
          status: 'skipped',
          progress: 100,
          currentStep: 'categorization.run',
        });

        return {
          success: true,
          contractId,
          contractType: contract.contractType ?? undefined,
          overallConfidence: 100,
          autoApplied: false,
          processingTimeMs: Date.now() - startTime,
        };
      }
    }

    // Skip if already categorized and not forcing
    if (contract.contractType && contract.category && !forceRecategorize) {
      await updateStep({
        tenantId,
        contractId,
        step: 'categorization.run',
        status: 'skipped',
        progress: 100,
        currentStep: 'categorization.run',
      });

      return {
        success: true,
        contractId,
        contractType: contract.contractType,
        overallConfidence: 100,
        autoApplied: false,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Check for text
    if (!contract.rawText || contract.rawText.length < 100) {
      throw new RetryableError('Contract has insufficient text for categorization');
    }

    await job.updateProgress(20);

    // Categorize
    const categorizer = new AIContractCategorizer();
    const result = await categorizer.categorize(contract.rawText, {
      contractId,
      model: "gpt-4o-mini",
      includeReasoning: true,
      detectRegulatory: true,
      extractParties: true,
    });

    await job.updateProgress(80);

    // Determine if we should auto-apply based on tenant settings
    const shouldAutoApply = (autoApply && tenantAutoApply) && 
      (result.overallConfidence / 100) >= autoApplyThreshold;

    // =========================================================================
    // ENHANCED TAXONOMY MATCHING
    // Uses multi-signal scoring with keyword matching and AI classification
    // =========================================================================
    
    let matchedCategoryL1: { id: string; name: string; path: string; score?: number } | null = null;
    let matchedCategoryL2: { id: string; name: string; path: string; parentId: string | null; score?: number } | null = null;
    
    // Fetch all active taxonomy categories with keywords for scoring
    const allCategories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        path: true,
        level: true,
        parentId: true,
        keywords: true,
        description: true,
        aiClassificationPrompt: true,
      },
      orderBy: { level: 'asc' },
    });

    // Build scoring for each category based on multiple signals
    interface CategoryScore {
      category: typeof allCategories[0];
      score: number;
      signals: string[];
    }

    const categoryScores: CategoryScore[] = [];
    
    // Extract signals from AI result
    const contractTypeValue = result.contractType.value;
    const industryValue = result.industry.value;
    const extractedTags = result.subjectTags || [];
    const regulatoryDomains = result.regulatoryDomains || [];
    const allSignals = [
      contractTypeValue.toLowerCase(),
      industryValue.toLowerCase(),
      ...extractedTags.map(t => t.toLowerCase()),
      ...regulatoryDomains.map(r => r.toLowerCase()),
    ];

    // Industry to taxonomy category mapping (L1 first, then L2)
    const industryToCategoryMap: Record<string, string[]> = {
      'TECHNOLOGY': ['Information Technology', 'Software & Applications', 'Cloud & Infrastructure'],
      'HEALTHCARE': ['Research & Development', 'Clinical Trials'],
      'FINANCE': ['Finance & Accounting', 'Banking & Treasury'],
      'MANUFACTURING': ['Operations', 'Manufacturing'],
      'RETAIL': ['Sales & Revenue', 'Procurement'],
      'ENERGY': ['Operations', 'Utilities'],
      'GOVERNMENT': ['Legal & Compliance', 'Compliance Services'],
      'EDUCATION': ['Human Resources', 'Training & Development'],
      'REAL_ESTATE': ['Real Estate & Facilities', 'Office Leases'],
      'LEGAL': ['Legal & Compliance', 'Outside Counsel'],
      'MEDIA': ['Marketing & Communications', 'Creative Services'],
      'TRANSPORTATION': ['Operations', 'Logistics & Shipping'],
      'HOSPITALITY': ['Operations', 'Facility Services'],
      'AGRICULTURE': ['Operations', 'Manufacturing'],
      'CONSTRUCTION': ['Real Estate & Facilities', 'Construction'],
    };

    // Contract type to category hints (L1 first, then L2)
    const contractTypeCategoryHints: Record<string, string[]> = {
      'MSA': ['Procurement', 'Strategic Vendors'],
      'SOW': ['Professional Services', 'Consulting'],
      'NDA': ['Legal & Compliance'],
      'LICENSE': ['Information Technology', 'Software & Applications'],
      'EMPLOYMENT': ['Human Resources', 'Recruitment & Staffing'],
      'CONSULTING': ['Professional Services', 'Consulting'],
      'VENDOR': ['Procurement', 'Strategic Vendors'],
      'PURCHASE': ['Procurement', 'Commodity Vendors'],
      'LEASE': ['Real Estate & Facilities', 'Office Leases'],
      'SUBSCRIPTION': ['Information Technology', 'Software & Applications'],
      'DPA': ['Legal & Compliance', 'Compliance Services'],
      'SLA': ['Information Technology', 'Cloud & Infrastructure'],
      'PARTNERSHIP': ['Corporate Development', 'Joint Ventures'],
      'SUBCONTRACT': ['Procurement', 'Strategic Vendors'],
    };

    // Calculate score for each category
    for (const cat of allCategories) {
      let score = 0;
      const signals: string[] = [];
      const catNameLower = cat.name.toLowerCase();
      const catDescLower = (cat.description || '').toLowerCase();
      const catKeywords = (cat.keywords || []).map(k => k.toLowerCase());

      // Signal 1: Direct name match from mapping (highest weight: 40 points)
      const industryHints = industryToCategoryMap[industryValue] || [];
      const typeHints = contractTypeCategoryHints[contractTypeValue] || [];
      if (industryHints.includes(cat.name) || typeHints.includes(cat.name)) {
        score += 40;
        signals.push('mapping_match');
      }

      // Signal 2: Keyword matching (up to 30 points)
      let keywordMatches = 0;
      for (const signal of allSignals) {
        if (catKeywords.some(kw => kw.includes(signal) || signal.includes(kw))) {
          keywordMatches++;
        }
        // Also check if signal appears in category name or description
        if (catNameLower.includes(signal) || catDescLower.includes(signal)) {
          keywordMatches++;
        }
      }
      const keywordScore = Math.min(keywordMatches * 6, 30);
      if (keywordScore > 0) {
        score += keywordScore;
        signals.push(`keywords:${keywordMatches}`);
      }

      // Signal 3: Subject tag overlap with category keywords (up to 20 points)
      let tagOverlap = 0;
      for (const tag of extractedTags) {
        const tagLower = tag.toLowerCase();
        if (catKeywords.includes(tagLower) || catNameLower.includes(tagLower)) {
          tagOverlap++;
        }
      }
      const tagScore = Math.min(tagOverlap * 5, 20);
      if (tagScore > 0) {
        score += tagScore;
        signals.push(`tags:${tagOverlap}`);
      }

      // Signal 4: Contract type name in category (10 points)
      if (catNameLower.includes(contractTypeValue.toLowerCase()) || 
          catKeywords.includes(contractTypeValue.toLowerCase())) {
        score += 10;
        signals.push('type_in_name');
      }

      if (score > 0) {
        categoryScores.push({ category: cat, score, signals });
      }
    }

    // Sort by score descending
    categoryScores.sort((a, b) => b.score - a.score);

    // Find best L1 and L2 matches
    const l1Candidates = categoryScores.filter(cs => cs.category.level === 0);
    const l2Candidates = categoryScores.filter(cs => cs.category.level === 1);

    if (l1Candidates.length > 0) {
      const best = l1Candidates[0];
      if (best) {
        matchedCategoryL1 = { 
          id: best.category.id, 
          name: best.category.name, 
          path: best.category.path,
          score: best.score,
        };
      }
    }

    if (l2Candidates.length > 0) {
      // Prefer L2 that belongs to matched L1
      let bestL2 = matchedCategoryL1 
        ? l2Candidates.find(cs => cs.category.parentId === matchedCategoryL1?.id)
        : undefined;
      
      // If no L2 under the matched L1, take the highest scoring L2
      if (!bestL2 && l2Candidates[0]) {
        bestL2 = l2Candidates[0];
      }

      if (bestL2) {
        matchedCategoryL2 = { 
          id: bestL2.category.id, 
          name: bestL2.category.name, 
          path: bestL2.category.path, 
          parentId: bestL2.category.parentId,
          score: bestL2.score,
        };

        // If we found L2 but not L1, get the L1 from L2's parent
        if (!matchedCategoryL1 && bestL2.category.parentId) {
          const parentCat = await prisma.taxonomyCategory.findUnique({
            where: { id: bestL2.category.parentId },
            select: { id: true, name: true, path: true },
          });
          if (parentCat) {
            matchedCategoryL1 = { ...parentCat, score: 0 };
          }
        }
      }
    }

    // =========================================================================
    // AI-DRIVEN CATEGORY SELECTION (Fallback for low-scoring matches)
    // If signal scoring didn't find a confident match, ask AI to pick directly
    // =========================================================================
    const minConfidentScore = 30; // Minimum score to consider a confident match
    const bestL1Score = matchedCategoryL1?.score || 0;
    const bestL2Score = matchedCategoryL2?.score || 0;

    if (bestL1Score < minConfidentScore && bestL2Score < minConfidentScore && allCategories.length > 0) {
      try {
        const { openai } = await import("@/lib/openai-client");
        
        if (!openai) {
          throw new Error('OpenAI client not available');
        }
        
        // Build category options for AI
        const l1Options = allCategories
          .filter(c => c.level === 0)
          .map(c => `- ${c.name}: ${c.description || 'No description'} [keywords: ${(c.keywords || []).slice(0, 5).join(', ')}]`)
          .join('\n');

        const contractSummary = contract.rawText?.substring(0, 3000) || '';
        
        const aiResponse = await openai.chat({
          messages: [
            {
              role: 'system',
              content: `You are a contract categorization expert. Given a contract excerpt and a list of business function categories, select the BEST matching L1 category. Respond with JSON only: {"categoryName": "exact category name", "confidence": 0-100, "reasoning": "brief explanation"}`
            },
            {
              role: 'user',
              content: `Contract Type: ${result.contractType.value}\nIndustry: ${result.industry.value}\n\nContract Excerpt:\n${contractSummary}\n\nAvailable Categories:\n${l1Options}\n\nSelect the best matching category.`
            }
          ],
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        });

        const aiPick = JSON.parse(aiResponse.choices[0]?.message?.content || '{}');
        
        if (aiPick.categoryName) {
          const aiMatchedCat = allCategories.find(c => 
            c.level === 0 && c.name.toLowerCase() === aiPick.categoryName.toLowerCase()
          );
          
          if (aiMatchedCat && aiPick.confidence > 50) {
            matchedCategoryL1 = {
              id: aiMatchedCat.id,
              name: aiMatchedCat.name,
              path: aiMatchedCat.path,
              score: aiPick.confidence,
            };
            
            // Also try to find best L2 under this L1
            const l2UnderL1 = allCategories.filter(c => c.level === 1 && c.parentId === aiMatchedCat.id);
            if (l2UnderL1.length > 0) {
              // Use keyword matching to pick best L2
              let bestL2Match = l2UnderL1[0];
              let bestL2MatchScore = 0;
              
              for (const l2 of l2UnderL1) {
                let l2Score = 0;
                const l2Keywords = (l2.keywords || []).map(k => k.toLowerCase());
                for (const signal of allSignals) {
                  if (l2Keywords.some(kw => kw.includes(signal) || signal.includes(kw))) {
                    l2Score += 10;
                  }
                }
                if (l2Score > bestL2MatchScore) {
                  bestL2MatchScore = l2Score;
                  bestL2Match = l2;
                }
              }
              
              if (bestL2Match) {
                matchedCategoryL2 = {
                  id: bestL2Match.id,
                  name: bestL2Match.name,
                  path: bestL2Match.path,
                  parentId: bestL2Match.parentId,
                  score: bestL2MatchScore || 20, // Minimum score for AI-derived L2
                };
              }
            }
          }
        }
      } catch {
        // AI category selection failed, using signal-based match
      }
    }

    if (shouldAutoApply) {
      // Map risk level to score
      const riskScoreMap: Record<string, number> = {
        LOW: 20,
        MEDIUM: 50,
        HIGH: 75,
        CRITICAL: 95,
      };

      // Update contract with L1/L2 category assignments
      const existingMetadata = ((contract.metadata as Record<string, unknown>) || {}) as any;
      
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          contractType: result.contractType.value,
          // Primary category is L2 if available, otherwise L1
          contractCategoryId: matchedCategoryL2?.id || matchedCategoryL1?.id || null,
          // Store L1/L2 names for quick access
          categoryL1: matchedCategoryL1?.name || null,
          categoryL2: matchedCategoryL2?.name || null,
          keywords: result.subjectTags,
          classifiedAt: new Date(),
          // Store full categorization in metadata JSON field
          metadata: JSON.parse(JSON.stringify({
            ...existingMetadata,
            _categorization: {
              contractType: result.contractType,
              industry: result.industry,
              riskLevel: result.riskLevel,
              complexity: result.complexity,
              regulatoryDomains: result.regulatoryDomains,
              parties: result.parties,
              scope: result.scope,
              flags: result.flags,
              overallConfidence: result.overallConfidence,
              // Full taxonomy classification with scoring
              taxonomy: {
                categoryL1: matchedCategoryL1 ? {
                  id: matchedCategoryL1.id,
                  name: matchedCategoryL1.name,
                  path: matchedCategoryL1.path,
                  matchScore: matchedCategoryL1.score || 0,
                } : null,
                categoryL2: matchedCategoryL2 ? {
                  id: matchedCategoryL2.id,
                  name: matchedCategoryL2.name,
                  path: matchedCategoryL2.path,
                  matchScore: matchedCategoryL2.score || 0,
                } : null,
                // Top alternative matches for review
                alternatives: categoryScores.slice(0, 5).map(cs => ({
                  id: cs.category.id,
                  name: cs.category.name,
                  level: cs.category.level,
                  score: cs.score,
                  signals: cs.signals,
                })),
              },
              rawTextHash,
              categorizedAt: new Date().toISOString(),
              source,
            },
          })),
          updatedAt: new Date(),
        },
      });
    } else {
      // Store results but don't apply - still suggest categories
      const existingMetadata = ((contract.metadata as Record<string, unknown>) || {}) as any;
      
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          metadata: JSON.parse(JSON.stringify({
            ...existingMetadata,
            _pendingCategorization: {
              contractType: result.contractType,
              industry: result.industry,
              riskLevel: result.riskLevel,
              complexity: result.complexity,
              regulatoryDomains: result.regulatoryDomains,
              overallConfidence: result.overallConfidence,
              // Suggested taxonomy classification with scoring
              suggestedTaxonomy: {
                categoryL1: matchedCategoryL1 ? {
                  id: matchedCategoryL1.id,
                  name: matchedCategoryL1.name,
                  path: matchedCategoryL1.path,
                  matchScore: matchedCategoryL1.score || 0,
                } : null,
                categoryL2: matchedCategoryL2 ? {
                  id: matchedCategoryL2.id,
                  name: matchedCategoryL2.name,
                  path: matchedCategoryL2.path,
                  matchScore: matchedCategoryL2.score || 0,
                } : null,
                // Top alternatives for human review
                alternatives: categoryScores.slice(0, 5).map(cs => ({
                  id: cs.category.id,
                  name: cs.category.name,
                  level: cs.category.level,
                  score: cs.score,
                  signals: cs.signals,
                })),
              },
              rawTextHash,
              categorizedAt: new Date().toISOString(),
              needsReview: true,
              reviewReason: result.overallConfidence < 60 
                ? 'Low AI confidence' 
                : 'Below auto-apply threshold',
            },
          })),
        },
      });
    }

    await job.updateProgress(100);

    await updateStep({
      tenantId,
      contractId,
      step: 'categorization.run',
      status: 'completed',
      progress: 100,
      currentStep: 'categorization.run',
    });

    return {
      success: true,
      contractId,
      contractType: result.contractType.value,
      industry: result.industry.value,
      riskLevel: result.riskLevel.value,
      complexity: result.complexity.value,
      overallConfidence: result.overallConfidence,
      autoApplied: shouldAutoApply,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    await updateStep({
      tenantId,
      contractId,
      step: 'categorization.run',
      status: 'failed',
      progress: 100,
      currentStep: 'categorization.run',
      error: errorMessage,
    });

    if (error instanceof Error && error.name === 'RetryableError') {
      throw error;
    }

    return {
      success: false,
      contractId,
      overallConfidence: 0,
      autoApplied: false,
      processingTimeMs: Date.now() - startTime,
      errors,
    };
  }
}

// ============================================================================
// QUEUE HELPERS
// ============================================================================

/**
 * Queue a categorization job
 */
export async function queueCategorizationJob(
  data: CategorizationJobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
): Promise<string> {
  const { getQueueService } = await import("@repo/utils/queue/queue-service");
  
  const queueService = getQueueService();
  const jobId = options?.jobId || `categorize-${data.contractId}-${Date.now()}`;
  
  await queueService.addJob(
    CATEGORIZATION_QUEUE,
    "categorize-contract",
    data,
    {
      priority: options?.priority ?? (data.priority === "high" ? 1 : data.priority === "low" ? 10 : 5),
      delay: options?.delay,
      jobId,
    }
  );
  
  return jobId;
}

/**
 * Queue categorization for multiple contracts
 */
export async function queueBulkCategorization(
  contractIds: string[],
  tenantId: string,
  options?: Partial<CategorizationJobData>
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const contractId of contractIds) {
    const jobId = await queueCategorizationJob({
      contractId,
      tenantId,
      priority: "low",
      source: "bulk",
      ...options,
    });
    jobIds.push(jobId);
  }
  
  return jobIds;
}

// ============================================================================
// WORKER REGISTRATION
// ============================================================================

const logger = pino({
  name: "categorization-worker",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});

/**
 * Register the categorization worker
 */
export function registerCategorizationWorker(): Worker {
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
  };

  const worker = new Worker(
    CATEGORIZATION_QUEUE,
    async (job) => {
      logger.info({ jobId: job.id, contractId: job.data.contractId }, "Processing categorization job");
      
      try {
        const result = await processCategorizationJob(job);
        
        logger.info({
          jobId: job.id,
          contractId: job.data.contractId,
          contractType: result.contractType,
          confidence: result.overallConfidence,
          autoApplied: result.autoApplied,
        }, "Categorization completed");
        
        return result;
      } catch (error) {
        logger.error({
          jobId: job.id,
          contractId: job.data.contractId,
          error: error instanceof Error ? error.message : String(error),
        }, "Categorization failed");
        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: getWorkerConcurrency('CATEGORIZATION_WORKER_CONCURRENCY', CATEGORIZATION_CONFIG.concurrency),
      limiter: getWorkerLimiter(
        'CATEGORIZATION_WORKER_LIMIT_MAX',
        'CATEGORIZATION_WORKER_LIMIT_DURATION_MS',
        CATEGORIZATION_CONFIG.limiter
      ),
    }
  );

  worker.on("completed", (job, result) => {
    logger.info({ 
      jobId: job.id, 
      contractId: job.data.contractId,
      type: result?.contractType,
    }, "✅ Categorization job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({
      jobId: job?.id,
      contractId: job?.data.contractId,
      error: error.message,
    }, "❌ Categorization job failed");
  });

  worker.on("error", (error) => {
    logger.error({ error: error.message }, "Worker error");
  });

  logger.info("🏷️ Categorization worker registered");
  
  return worker;
}
