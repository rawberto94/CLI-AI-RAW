import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

// Use any for Job type due to cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any };
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import { ArtifactType } from 'clients-db';
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, GenerateArtifactsJobData } from '@repo/utils/queue/contract-queue';
import pino from 'pino';

import { getTraceContextFromJobData } from './observability/trace';
import { CircuitBreaker } from './utils/circuit-breaker';
import { hashJson } from './utils/hash';
import { ensureProcessingJob, updateStep } from './workflow/processing-job';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';
import { ArtifactQualityValidator, selfCritiqueArtifact } from './utils/artifact-quality-validator';
import { AdaptiveRetryStrategy, chunkTextForModel } from './utils/adaptive-retry-strategy';
import { logAIUsage } from './utils/ai-usage-logger';
import {
  ContractType as ProfileContractType,
  detectContractType,
  getContractProfile,
  isArtifactApplicable,
  getEnhancedPromptHints,
} from './contract-type-profiles';
import {
  DEFAULT_ARTIFACT_TYPES as SHARED_ARTIFACT_TYPES,
  buildArtifactPrompt,
  getSystemPrompt,
  getFallbackTemplate,
  safeParseJSON as sharedSafeParseJSON,
  estimateTokenCost,
  ArtifactCostTracker,
  PROMPT_VERSION,
  UNIFIED_QUALITY_THRESHOLDS,
  type ArtifactTypeConfig as SharedArtifactTypeConfig,
  type PromptContext,
} from './utils/artifact-prompts';

// Use unified artifact type config from shared module
interface ArtifactTypeConfig {
  type: ArtifactType;
  enabled: boolean;
  priority: number;
  weight: number;
  qualityThreshold: number;
  maxRetries: number;
  label: string;
  category: 'core' | 'analysis' | 'advanced';
}

// Map shared config to local type (adds ArtifactType cast)
const DEFAULT_ARTIFACT_TYPES: ArtifactTypeConfig[] = SHARED_ARTIFACT_TYPES.map(t => ({
  ...t,
  type: t.type as ArtifactType,
}));

// Unified cost tracker for this worker
const costTracker = new ArtifactCostTracker();

// Dynamic artifact config loader (fetches tenant-specific settings from DB)
async function loadTenantArtifactConfig(tenantId: string): Promise<{
  artifactTypes: ArtifactTypeConfig[];
  generationConfig: {
    maxRegenerationAttempts: number;
    enableQualityValidation: boolean;
    enableSelfCritique: boolean;
    continueOnPartialFailure: boolean;
    enableFallbackOnError: boolean;
  };
}> {
  try {
    // Try to load tenant-specific config from TenantConfig.workflowSettings
    const tenantConfig = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { workflowSettings: true },
    });

    if (tenantConfig?.workflowSettings && typeof tenantConfig.workflowSettings === 'object') {
      const settings = tenantConfig.workflowSettings as Record<string, any>;
      const artifactSettings = settings.artifactTypes || {};
      const generationSettings = settings.artifactGeneration || {};

      // Merge tenant overrides with defaults
      const artifactTypes = DEFAULT_ARTIFACT_TYPES.map(defaultType => {
        const override = artifactSettings[defaultType.type] || {};
        return {
          ...defaultType,
          enabled: override.enabled ?? defaultType.enabled,
          priority: override.priority ?? defaultType.priority,
          qualityThreshold: override.qualityThreshold ?? defaultType.qualityThreshold,
          maxRetries: override.maxRetries ?? defaultType.maxRetries,
        };
      }).filter(t => t.enabled).sort((a, b) => a.priority - b.priority);

      return {
        artifactTypes,
        generationConfig: {
          maxRegenerationAttempts: generationSettings.maxRegenerationAttempts ?? 2,
          enableQualityValidation: generationSettings.enableQualityValidation ?? true,
          enableSelfCritique: generationSettings.enableSelfCritique ?? true,
          continueOnPartialFailure: generationSettings.continueOnPartialFailure ?? true,
          enableFallbackOnError: generationSettings.enableFallbackOnError ?? true,
        },
      };
    }
  } catch (error) {
    logger.warn({ tenantId, error }, 'Failed to load tenant artifact config, using defaults');
  }

  // Return defaults if no tenant config
  return {
    artifactTypes: DEFAULT_ARTIFACT_TYPES.filter(t => t.enabled),
    generationConfig: {
      maxRegenerationAttempts: 2,
      enableQualityValidation: true,
      enableSelfCritique: true,
      continueOnPartialFailure: true,
      enableFallbackOnError: true,
    },
  };
}

const logger = pino({ name: 'artifact-generator-worker' });
const prisma = getClient();

// Module-level OpenAI singleton — avoids re-instantiation per artifact call
let _openaiSingleton: any = null;
async function getOpenAIClient(): Promise<any> {
  if (_openaiSingleton) return _openaiSingleton;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const OpenAI = (await import('openai')).default;
  _openaiSingleton = new OpenAI({ apiKey });
  return _openaiSingleton;
}

const openaiBreaker = new CircuitBreaker({
  failureThreshold: Number.parseInt(process.env.OPENAI_BREAKER_FAILURE_THRESHOLD || '5', 10),
  cooldownMs: Number.parseInt(process.env.OPENAI_BREAKER_COOLDOWN_MS || '30000', 10),
});

// Quality validation and adaptive retry
// Quality validation using unified thresholds
const qualityValidator = new ArtifactQualityValidator(UNIFIED_QUALITY_THRESHOLDS);

const adaptiveRetry = new AdaptiveRetryStrategy({
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
});

// Enhanced configuration for error recovery
const ARTIFACT_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
  timeoutMs: 120000, // 2 minutes per artifact
  enableFallbackOnError: true,
  continueOnPartialFailure: true,
};

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    backoffMultiplier: number;
    operationName: string;
  }
): Promise<T> {
  let lastError: Error | null = null;
  let delay = options.initialDelay;
  
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < options.maxRetries) {
        logger.warn({
          operation: options.operationName,
          attempt,
          maxRetries: options.maxRetries,
          delay,
          error: lastError.message,
        }, `${options.operationName} failed, retrying...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= options.backoffMultiplier;
      }
    }
  }
  
  throw lastError;
}

/**
 * Safely parse JSON with error handling (delegates to shared module)
 */
function safeParseJSON(text: string, artifactType: string): Record<string, any> | null {
  return sharedSafeParseJSON(text, artifactType);
}

interface ArtifactResult {
  artifactsCreated: number;
  artifactIds: string[];
  failedArtifacts?: string[];
  partialSuccess?: boolean;
}

/**
 * Artifact Generation Worker
 * Generates AI-powered artifacts for contracts
 */
export async function generateArtifactsJob(
  job: JobType<GenerateArtifactsJobData>
): Promise<ArtifactResult> {
  const { contractId, tenantId, contractText } = job.data;
  const trace = getTraceContextFromJobData(job.data);

  logger.info(
    { contractId, tenantId, jobId: job.id },
    'Starting artifact generation'
  );

  const artifactIds: string[] = [];

  try {
    await ensureProcessingJob({
      tenantId,
      contractId,
      queueId: job.id ? String(job.id) : undefined,
      traceId: trace.traceId,
    });

    await updateStep({
      tenantId,
      contractId,
      step: 'artifacts.generate',
      status: 'running',
      progress: 5,
      currentStep: 'artifacts.generate',
    });

    await job.updateProgress(5);

    // Validate contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // ── Contract Type Detection ─────────────────────────────────────────
    // The upstream categorization worker should have already set contractType.
    // Only fall back to keyword detection if it's still OTHER/UNKNOWN.
    // Skip expensive AI detection here — it was already attempted upstream.
    let detectedContractType: ProfileContractType = (contract.contractType as ProfileContractType) || 'OTHER';
    if (detectedContractType === 'OTHER' || (contract.contractType as string) === 'UNKNOWN') {
      try {
        const keywordResult = detectContractType(contractText);
        if (keywordResult.confidence >= 0.5) {
          detectedContractType = keywordResult.type;
          logger.info({ contractId, type: detectedContractType, confidence: keywordResult.confidence, method: 'keyword-fallback' }, 'Contract type detected via keyword fallback in artifact generator');
          // Persist detected type
          await prisma.contract.update({
            where: { id: contractId, tenantId },
            data: { contractType: detectedContractType },
          });
        }
      } catch (typeDetectionError) {
        logger.warn({ contractId, error: typeDetectionError }, 'Contract type detection failed, using OTHER');
      }
    }
    const contractTypeProfile = getContractProfile(detectedContractType);
    logger.info({ contractId, detectedContractType, profileName: contractTypeProfile.displayName }, 'Using contract type profile for artifact extraction');

    // Load tenant-configurable artifact types (sorted by priority)
    const tenantConfig = await loadTenantArtifactConfig(tenantId);
    const allArtifactTypes = tenantConfig.artifactTypes.map(config => ({
      type: config.type,
      weight: config.weight,
      config,
    }));
    const generationConfig = tenantConfig.generationConfig;

    // Filter artifacts by contract type relevance (skip not-applicable)
    const artifactTypes = allArtifactTypes.filter(({ type }) =>
      isArtifactApplicable(detectedContractType, type as any)
    );
    const skippedArtifacts = allArtifactTypes
      .filter(({ type }) => !isArtifactApplicable(detectedContractType, type as any))
      .map(a => a.type);

    logger.info({
      tenantId,
      contractId,
      contractType: detectedContractType,
      enabledArtifacts: artifactTypes.map(a => a.type),
      skippedArtifacts,
      totalEnabled: artifactTypes.length,
      totalSkipped: skippedArtifacts.length,
    }, 'Using type-filtered artifact types');

    let progressBase = 10;
    const failedArtifacts: string[] = [];

    // DB-backed daily cost guard: check actual DB usage across all workers
    // This survives restarts and works in multi-worker deployments
    const maxTenantDaily = parseFloat(process.env.MAX_ARTIFACT_COST_PER_TENANT_DAILY || '50.00');
    try {
      const { getTenantDailyCost } = await import('./utils/ai-usage-logger');
      const dbDailyCost = await getTenantDailyCost(tenantId);
      if (dbDailyCost >= maxTenantDaily) {
        logger.warn({ contractId, tenantId, dbDailyCost, maxTenantDaily }, '⛔ Tenant daily cost limit reached (DB-backed) — skipping all artifact generation');
        return { artifactsCreated: 0, artifactIds: [], failedArtifacts: artifactTypes.map(a => a.type), partialSuccess: false };
      }
      if (dbDailyCost >= maxTenantDaily * 0.8) {
        logger.warn({ contractId, tenantId, dbDailyCost, maxTenantDaily }, '⚠️ Tenant nearing daily cost limit (DB-backed)');
      }
    } catch (costCheckErr) {
      logger.warn({ error: costCheckErr }, 'DB cost check failed — falling back to in-memory tracker');
    }

    // Generate each artifact with retry logic (using tenant config)
    for (const { type, weight, config } of artifactTypes) {
      // Budget guard: check per-contract and per-tenant cost limits before each artifact
      const budgetCheck = costTracker.canProceed(contractId, tenantId);
      if (!budgetCheck.allowed) {
        logger.warn({ contractId, tenantId, type, reason: budgetCheck.reason }, '⛔ Artifact generation blocked by cost budget');
        failedArtifacts.push(type);
        continue;
      }
      if (budgetCheck.warning) {
        logger.warn({ contractId, tenantId, type, warning: budgetCheck.warning }, '⚠️ Approaching cost limit');
      }

      try {
        await updateStep({
          tenantId,
          contractId,
          step: `artifact.${type}`,
          status: 'running',
          progress: progressBase,
          currentStep: `artifact.${type}`,
        });

        logger.info({ 
          contractId, 
          type, 
          traceId: trace.traceId,
          qualityThreshold: config?.qualityThreshold || 0.7,
          maxRetries: config?.maxRetries || 3,
        }, `Generating ${type} artifact with quality validation`);

        // Generate artifact with adaptive retry and quality validation
        let artifactData: Record<string, any> | null = null;
        let qualityScore: any = null;
        let modelUsed = 'unknown';
        let regenerationAttempts = 0;
        const maxRegenerations = config?.maxRetries || generationConfig.maxRegenerationAttempts || 2;

        while (regenerationAttempts <= maxRegenerations) {
          try {
            // Use adaptive retry strategy with model fallback
            const result = await adaptiveRetry.executeWithRetry(
              async (model) => {
                modelUsed = model.name;
                const data = await generateArtifactData(type, contractText, contractId, tenantId, model.name, detectedContractType);
                return { data, model: model.name };
              },
              `Generate ${type} artifact`
            );

            artifactData = result.data;

            // Validate quality
            qualityScore = await qualityValidator.validateArtifact(
              type,
              artifactData,
              contractText
            );

            logger.info({
              contractId,
              type,
              qualityScore: qualityScore.overall.toFixed(2),
              passesThreshold: qualityScore.passesThreshold,
              configuredThreshold: config?.qualityThreshold || 0.7,
              model: modelUsed,
              regenerationAttempt: regenerationAttempts,
            }, '✓ Quality validation complete');

            // If quality meets configured threshold, proceed
            const qualityThreshold = config?.qualityThreshold || 0.7;
            const meetsThreshold = qualityScore.overall >= qualityThreshold;
            
            if (meetsThreshold || qualityScore.passesThreshold) {
              break;
            }

            // Self-critique for low quality (if enabled in config)
            if (!generationConfig.enableSelfCritique) {
              // Skip self-critique, accept current result
              break;
            }
            
            const critique = await selfCritiqueArtifact(type, artifactData, contractText);
            
            logger.warn({
              contractId,
              type,
              qualityScore: qualityScore.overall.toFixed(2),
              critiqueIssues: critique.issues.length,
              shouldRegenerate: critique.shouldRegenerate,
            }, '⚠️ Low quality detected');

            // Decide if should regenerate
            if (critique.shouldRegenerate && regenerationAttempts < maxRegenerations) {
              regenerationAttempts++;
              logger.info({ contractId, type, attempt: regenerationAttempts }, '🔄 Regenerating artifact due to quality issues');
              continue;
            } else {
              // Accept despite low quality
              logger.warn({ contractId, type }, '⚠️ Accepting low-quality artifact (max regenerations reached)');
              break;
            }
          } catch (error) {
            if (regenerationAttempts < maxRegenerations) {
              regenerationAttempts++;
              logger.warn({
                contractId,
                type,
                error: error instanceof Error ? error.message : String(error),
                attempt: regenerationAttempts,
              }, '⚠️ Generation failed, retrying...');
              continue;
            }
            throw error;
          }
        }

        if (!artifactData) {
          throw new Error(`Failed to generate ${type} artifact after ${regenerationAttempts} attempts`);
        }

        // Store artifact with quality metadata
        const artifact = await retryWithBackoff(
          () => createOrUpdateArtifact({
            contractId,
            tenantId,
            type,
            artifactData,
            validationStatus: qualityScore?.passesThreshold ? 'valid' : 'needs_review',
            modelUsed,
            promptVersion: PROMPT_VERSION,
            metadata: {
              qualityScore: qualityScore?.overall || 0,
              completeness: qualityScore?.completeness || 0,
              accuracy: qualityScore?.accuracy || 0,
              consistency: qualityScore?.consistency || 0,
              confidence: qualityScore?.confidence || 0,
              regenerationAttempts,
              qualityIssues: qualityScore?.issues || [],
              qualityRecommendations: qualityScore?.recommendations || [],
            },
          }),
          {
            maxRetries: 2,
            initialDelay: 500,
            backoffMultiplier: 2,
            operationName: `Save ${type} artifact`,
          }
        );

        artifactIds.push(artifact.id);
        logger.info({ contractId, artifactId: artifact.id, type, traceId: trace.traceId }, 'Artifact stored');

        progressBase += weight;
        await job.updateProgress(progressBase);

        await updateStep({
          tenantId,
          contractId,
          step: `artifact.${type}`,
          status: 'completed',
          progress: progressBase,
          currentStep: `artifact.${type}`,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMsg, contractId, type, traceId: trace.traceId }, `Failed to generate ${type} artifact after retries`);
        failedArtifacts.push(type);

        await updateStep({
          tenantId,
          contractId,
          step: `artifact.${type}`,
          status: 'failed',
          progress: progressBase,
          currentStep: `artifact.${type}`,
          error: errorMsg,
        });
        
        // If fallback is enabled (from tenant config), try to create a minimal artifact
        if (generationConfig.enableFallbackOnError) {
          try {
            const fallbackData = getFallbackArtifactData(type, contractId);

            // Never overwrite an existing artifact with fallback content.
            const existing = await prisma.artifact.findUnique({
              where: {
                contractId_type: {
                  contractId,
                  type: type as any,
                },
              },
              select: { id: true },
            });

            if (!existing) {
              await createOrUpdateArtifact({
                contractId,
                tenantId,
                type,
                artifactData: { ...fallbackData, _fallback: true, _error: errorMsg },
                validationStatus: 'needs_review',
                modelUsed: null,
                promptVersion: PROMPT_VERSION,
              });
              logger.info({ contractId, type, traceId: trace.traceId }, 'Fallback artifact stored');
            } else {
              logger.info({ contractId, type, existingArtifactId: existing.id, traceId: trace.traceId }, 'Skipping fallback: artifact already exists');
            }
          } catch (fallbackError) {
            logger.warn({ contractId, type, fallbackError }, 'Failed to create fallback artifact');
          }
        }
        
        // Continue with other artifacts if configured (from tenant config)
        if (!generationConfig.continueOnPartialFailure) {
          throw error;
        }
      }
    }

    // Determine final status
    const hasPartialSuccess = failedArtifacts.length > 0 && artifactIds.length > 0;
    const hasCompleteFailure = artifactIds.length === 0;
    const finalStatus = hasCompleteFailure ? 'FAILED' : 'COMPLETED';

    // Update contract status based on outcome
    await prisma.contract.update({
      where: { id: contractId, tenantId },
      data: {
        status: finalStatus,
        updatedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    await updateStep({
      tenantId,
      contractId,
      step: 'artifacts.generate',
      status: 'completed',
      progress: 100,
      currentStep: 'artifacts.generate',
    });

    logger.info(
      { 
        contractId, 
        artifactCount: artifactIds.length,
        failedCount: failedArtifacts.length,
        partialSuccess: hasPartialSuccess,
      },
      'Artifact generation completed'
    );

    return {
      artifactsCreated: artifactIds.length,
      artifactIds,
      failedArtifacts: failedArtifacts.length > 0 ? failedArtifacts : undefined,
      partialSuccess: hasPartialSuccess,
    };
  } catch (error) {
    logger.error({ error, contractId, jobId: job.id }, 'Artifact generation failed');

    const errorMsg = error instanceof Error ? error.message : String(error);
    await updateStep({
      tenantId,
      contractId,
      step: 'artifacts.generate',
      status: 'failed',
      progress: 100,
      currentStep: 'artifacts.generate',
      error: errorMsg,
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId, tenantId },
      data: {
        status: 'FAILED',
        updatedAt: new Date(),
      },
    });

    throw error;
  }
}

async function createOrUpdateArtifact(args: {
  contractId: string;
  tenantId: string;
  type: ArtifactType;
  artifactData: Record<string, any>;
  validationStatus: string;
  modelUsed: string | null;
  promptVersion: string;
  metadata?: Record<string, any>;
}): Promise<{ id: string }> {
  const now = new Date();
  const { contractId, tenantId, type, artifactData, validationStatus, modelUsed, promptVersion, metadata } = args;

  // Validate artifact data against expected schema before saving
  const { validateArtifactData } = await import('./utils/artifact-schema-validator');
  const validation = validateArtifactData(type, artifactData);
  if (!validation.valid) {
    logger.error({ contractId, type, errors: validation.errors }, 'Artifact data failed schema validation');
    throw new Error(`Artifact validation failed for ${type}: ${validation.errors.join(', ')}`);
  }
  if (validation.warnings.length > 0) {
    logger.warn({ contractId, type, warnings: validation.warnings }, 'Artifact validation warnings');
  }

  // Hash only the stable content (exclude volatile meta like timestamps).
  const stableForHash = { ...artifactData } as any;
  delete stableForHash._meta;
  const nextHash = hashJson(stableForHash);
  const size = JSON.stringify(artifactData).length;

  try {
    const created = await prisma.artifact.create({
      data: {
        contractId,
        tenantId,
        type,
        data: artifactData,
        validationStatus,
        hash: nextHash,
        size,
        modelUsed: modelUsed ?? undefined,
        promptVersion,
        metadata: metadata || {},
        updatedAt: now,
      },
      select: { id: true, hash: true },
    });
    return created;
  } catch (error: any) {
    // Unique constraint hit means it already exists; fetch and update only if content changed.
    const existing = await prisma.artifact.findUnique({
      where: {
        contractId_type: {
          contractId,
          type,
        },
      },
      select: { id: true, hash: true },
    });

    if (!existing) {
      throw error;
    }

    if (existing.hash === nextHash) {
      return { id: existing.id };
    }

    const updated = await prisma.artifact.update({
      where: {
        contractId_type: {
          contractId,
          type,
        },
      },
      data: {
        data: artifactData,
        validationStatus,
        hash: nextHash,
        size,
        modelUsed: modelUsed ?? undefined,
        promptVersion,
        metadata: metadata || {},
        generationVersion: { increment: 1 },
        regeneratedAt: now,
        regenerationReason: 'artifact_content_changed',
        updatedAt: now,
      },
      select: { id: true },
    });

    return updated;
  }
}

/**
 * Generate artifact data using OpenAI API - REAL AI ANALYSIS
 * Now uses unified prompts from shared module + cost tracking.
 */
async function generateArtifactData(
  type: string,
  contractText: string,
  contractId: string,
  tenantId: string,
  modelName?: string,
  contractType?: string
): Promise<Record<string, any>> {

  try {
    const openai = await getOpenAIClient();
    if (!openai) {
      logger.warn('OPENAI_API_KEY not configured, using fallback templates');
      return getFallbackTemplate(type);
    }

    // Build contract-type-specific hints for enhanced extraction
    let contractTypeHints = '';
    if (contractType && contractType !== 'OTHER' && contractType !== 'UNKNOWN') {
      try {
        const profile = getContractProfile(contractType as ProfileContractType);
        const parts: string[] = [
          `This is a ${profile.displayName} (${contractType}).`,
          profile.description ? profile.description : '',
        ];
        if (profile.extractionHints) parts.push(`Extraction guidance: ${profile.extractionHints}`);
        if (profile.clauseCategories.length > 0)
          parts.push(`Key clause categories: ${profile.clauseCategories.slice(0, 8).join(', ')}`);
        if (profile.riskCategories.length > 0)
          parts.push(`Risk areas to assess: ${profile.riskCategories.slice(0, 6).join(', ')}`);
        if (profile.financialFields.length > 0)
          parts.push(`Financial fields to extract: ${profile.financialFields.slice(0, 6).join(', ')}`);
        if (profile.keyTermsToExtract.length > 0)
          parts.push(`Key terms to extract: ${profile.keyTermsToExtract.join(', ')}`);
        if (profile.mandatoryFields.length > 0)
          parts.push(`Mandatory fields: ${profile.mandatoryFields.join(', ')}`);
        if (profile.expectedSections.length > 0)
          parts.push(`Expected sections: ${profile.expectedSections.join(', ')}`);
        contractTypeHints = parts.filter(Boolean).join('\n');
      } catch {
        // Ignore profile lookup errors — degrade gracefully
      }
    }

    // Use unified prompt builder from shared module
    const promptCtx: PromptContext = {
      contractText,
      contractType,
      contractTypeHints: contractTypeHints || undefined,
    };

    const prompt = buildArtifactPrompt(type, promptCtx);
    if (!prompt) {
      return getFallbackTemplate(type);
    }

    // Use unified system prompt
    const systemPrompt = getSystemPrompt();

    logger.info({ type, contractId, textLength: contractText.length }, 'Calling OpenAI for artifact');

    const model = modelName || process.env.OPENAI_MODEL || 'gpt-4o';
    const response = await openaiBreaker.execute(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 8192,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      })
    ) as { choices: Array<{ message: { content: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');

    const parsed = safeParseJSON(content, type);
    if (!parsed) {
      throw new Error('Failed to parse JSON response');
    }

    // Track token usage and cost
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const cost = estimateTokenCost(model, promptTokens, completionTokens);

    // Feed cost into the budget tracker so per-contract/tenant limits are enforced
    costTracker.addCost(contractId, tenantId, cost);

    // Persist usage to ai_usage_logs for dashboard & cost alerts
    logAIUsage({
      model,
      endpoint: 'openai',
      feature: `artifact-generation:${type}`,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      latencyMs: 0,
      success: true,
      tenantId,
      contractId,
    }).catch(() => {}); // fire-and-forget

    const artifactData = parsed;
    artifactData._meta = { 
      generatedAt: new Date().toISOString(), 
      aiGenerated: true,
      model,
      antiHallucinationEnabled: true,
      promptVersion: PROMPT_VERSION,
      tokensUsed: promptTokens + completionTokens,
      promptTokens,
      completionTokens,
      estimatedCost: cost,
    };
    
    logger.info({ type, contractId, certainty: artifactData.certainty, model, tokensUsed: promptTokens + completionTokens, cost: cost.toFixed(6) }, 'AI artifact generated successfully');
    return artifactData;

  } catch (error) {
    logger.error({ error, type, contractId }, 'OpenAI failed');
    throw error;
  }
}

/**
 * Get fallback artifact data (delegates to shared module)
 */
function getFallbackArtifactData(type: string, contractId: string): Record<string, any> {
  return getFallbackTemplate(type);
}

/**
 * Register artifact generator worker
 */
export function registerArtifactGeneratorWorker() {
  const queueService = getQueueService();

  const concurrency = getWorkerConcurrency('ARTIFACT_WORKER_CONCURRENCY', 5);
  const limiter = getWorkerLimiter(
    'ARTIFACT_WORKER_LIMIT_MAX',
    'ARTIFACT_WORKER_LIMIT_DURATION_MS',
    { max: 20, duration: 60000 }
  );

  const worker = queueService.registerWorker<GenerateArtifactsJobData, ArtifactResult>(
    QUEUE_NAMES.ARTIFACT_GENERATION,
    generateArtifactsJob,
    {
      concurrency,
      limiter,
      lockDuration: 240_000,    // 4 min — artifact generation is AI-heavy
      lockRenewTime: 60_000,
      stalledInterval: 60_000,
      maxStalledCount: 2,
      removeOnComplete: { age: 86400, count: 500 },
      removeOnFail: { age: 604800, count: 1000 },
    }
  );

  logger.info('Artifact generator worker registered');

  return worker;
}
