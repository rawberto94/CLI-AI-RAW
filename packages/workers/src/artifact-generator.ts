import dotenv from 'dotenv';
// Load environment variables FIRST, before any other imports that need them
dotenv.config();

// Use any for Job type due to cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any };
import clientsDb from 'clients-db';
const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
import type { ArtifactType } from 'clients-db';
import {
  getQueueService,
  JOB_NAMES,
  QUEUE_NAMES,
  publishJobProgress,
  redisEventBus,
  RedisEvents,
  type GenerateArtifactsJobData,
  type JobType,
} from './compat/repo-utils';
import pino from 'pino';

import { getTraceContextFromJobData } from './observability/trace';
import { CircuitBreaker } from './utils/circuit-breaker';
import { hashJson } from './utils/hash';
import { ensureProcessingJob, updateStep } from './workflow/processing-job';
import { buildProcessingPlan } from './workflow/planner';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';
import { ArtifactQualityValidator } from './utils/artifact-quality-validator';
import { AdaptiveRetryStrategy, chunkTextForModel } from './utils/adaptive-retry-strategy';
import { logAIUsage } from './utils/ai-usage-logger';
import {
  ContractType as ProfileContractType,
  detectContractType,
  getContractProfile,
  isArtifactApplicable,
  getEnhancedPromptHints,
  getMissingMandatoryFields,
  getTabPriorityOrder,
} from './contract-type-profiles';
import {
  DEFAULT_ARTIFACT_TYPES as SHARED_ARTIFACT_TYPES,
  DEFAULT_ARTIFACT_GROUPS,
  buildArtifactPrompt,
  buildGroupedPrompt,
  splitGroupedResponse,
  getSystemPrompt,
  getFallbackTemplate,
  safeParseJSON as sharedSafeParseJSON,
  estimateTokenCost,
  ArtifactCostTracker,
  PROMPT_VERSION,
  UNIFIED_QUALITY_THRESHOLDS,
  type ArtifactTypeConfig as SharedArtifactTypeConfig,
  type PromptContext,
  type ArtifactGroup,
} from './utils/artifact-prompts';
import { TokenAwarePool, estimateTokens } from './utils/token-pool';

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
  model: 'gpt-4o' | 'gpt-4o-mini';
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

// Module-level OpenAI singletons — avoids re-instantiation per artifact call.
// Azure OpenAI requires separate clients per deployment, so we keep one for the
// standard deployment and one for the mini deployment.
let _openaiSingleton: any = null;
let _openaiMiniSingleton: any = null;
async function getOpenAIClient(modelName: string = 'gpt-4o'): Promise<any> {
  const isMini = modelName.includes('mini');

  const apiKey = process.env.OPENAI_API_KEY;
  const isPlaceholderKey = !apiKey || /placeholder/i.test(apiKey);

  // Standard (non-Azure) OpenAI: a single client handles all model names.
  if (!isPlaceholderKey) {
    if (apiKey) {
      if (!_openaiSingleton) {
        const OpenAI = (await import('openai')).default;
        _openaiSingleton = new OpenAI({ apiKey });
      }
      return _openaiSingleton;
    }
    return null;
  }

  // Azure OpenAI path: each deployment is pinned to a model, so we need
  // separate clients for gpt-4o and gpt-4o-mini.
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!azureKey || !azureEndpoint) {
    return null;
  }

  const { AzureOpenAI } = await import('openai');
  const deployment = isMini
    ? (process.env.AZURE_OPENAI_MINI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT)
    : process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!deployment) {
    logger.warn({ modelName }, 'No Azure OpenAI deployment configured for model');
    return null;
  }

  if (isMini) {
    if (!_openaiMiniSingleton) {
      _openaiMiniSingleton = new AzureOpenAI({
        apiKey: azureKey,
        endpoint: azureEndpoint,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
        deployment,
      });
    }
    return _openaiMiniSingleton;
  }

  if (!_openaiSingleton) {
    _openaiSingleton = new AzureOpenAI({
      apiKey: azureKey,
      endpoint: azureEndpoint,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
      deployment,
    });
  }
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
  const successfulArtifactTypes: string[] = [];

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

    // Build the prompt context once per contract (DI structured data + type hints)
    const promptCtx = buildArtifactPromptContext(contractText, detectedContractType, contract);
    const systemPrompt = getSystemPrompt();

    // Group applicable artifact types into the predefined model-aware groups.
    // This replaces the 14 individual LLM calls with 3–4 grouped calls that send
    // the contract text only once per group.
    const applicableTypeSet = new Set(artifactTypes.map(a => a.type as string));
    const groups = DEFAULT_ARTIFACT_GROUPS
      .map(g => ({ ...g, types: g.types.filter(t => applicableTypeSet.has(t)) }))
      .filter(g => g.types.length > 0);

    // Token-aware concurrency pool: paces both in-flight calls and the TPM budget.
    const pool = new TokenAwarePool({
      concurrency: parseInt(process.env.ARTIFACT_WORKER_CONCURRENCY || '5', 10),
      tokensPerMinute: parseInt(process.env.ARTIFACT_TPM_LIMIT || '17000', 10),
    });

    const totalWeight = artifactTypes.reduce((sum, { weight }) => sum + weight, 0);
    let completedWeight = 0;

    const groupTasks = groups.map((group, groupIndex) => ({ group, groupIndex }));
    const groupResults = await Promise.allSettled(groupTasks.map(async ({ group }) => {
      // Budget guard
      const budgetCheck = costTracker.canProceed(contractId, tenantId);
      if (!budgetCheck.allowed) {
        logger.warn({ contractId, tenantId, group: group.name, reason: budgetCheck.reason }, '⛔ Artifact group generation blocked by cost budget');
        throw new Error(`Budget limit reached: ${budgetCheck.reason}`);
      }
      if (budgetCheck.warning) {
        logger.warn({ contractId, tenantId, group: group.name, warning: budgetCheck.warning }, '⚠️ Approaching cost limit');
      }

      // Mark all artifact types in the group as running
      for (const type of group.types) {
        await updateStep({
          tenantId,
          contractId,
          step: `artifact.${type}`,
          status: 'running',
          progress: progressBase + Math.round((completedWeight / totalWeight) * 80),
          currentStep: `artifact.${type}`,
        });
      }

      logger.info({
        contractId,
        group: group.name,
        types: group.types,
        model: group.model,
        traceId: trace.traceId,
      }, `Generating ${group.name} artifact group`);

      const groupedPrompt = buildGroupedPrompt(group, promptCtx);
      const estimatedTokens = estimateTokens(systemPrompt + (groupedPrompt || '')) + 2000;

      return pool.execute(estimatedTokens, async () => {
        const result = await adaptiveRetry.executeWithRetry(
          async (model) => {
            const data = await generateGroupData(group, promptCtx, contractId, tenantId, model.name);
            return { data, model: model.name };
          },
          `Generate ${group.name} group`,
          group.model
        );
        return { group, modelUsed: result.model, groupResult: result.data };
      });
    }));

    // Process each group result and save individual artifacts
    for (let i = 0; i < groupResults.length; i++) {
      const group = groupTasks[i].group;
      const groupResult = groupResults[i];

      if (groupResult.status === 'fulfilled') {
        const { modelUsed, groupResult: dataMap } = groupResult.value;

        for (const type of group.types) {
          const config = artifactTypes.find(a => a.type === type)?.config;
          let artifactData = dataMap[type];
          let qualityScore: any = null;

          try {
            qualityScore = await qualityValidator.validateArtifact(type, artifactData, contractText);
            logger.info({
              contractId,
              type,
              qualityScore: qualityScore?.overall?.toFixed(2),
              passesThreshold: qualityScore?.passesThreshold,
              configuredThreshold: config?.qualityThreshold || 0.7,
              model: modelUsed,
            }, '✓ Quality validation complete');
          } catch (validationError) {
            logger.warn({ contractId, type, error: validationError instanceof Error ? validationError.message : String(validationError) }, 'Artifact quality validation failed');
          }

          const qualityThreshold = config?.qualityThreshold || 0.7;
          const meetsThreshold = qualityScore?.overall >= qualityThreshold || qualityScore?.passesThreshold;

          if (!artifactData || !meetsThreshold) {
            artifactData = artifactData || getFallbackArtifactData(type, contractId);
            logger.warn({
              contractId,
              type,
              qualityScore: qualityScore?.overall?.toFixed(2),
              threshold: qualityThreshold,
            }, '⚠️ Artifact below quality threshold or missing; storing as needs_review');
            failedArtifacts.push(type);
            await updateStep({
              tenantId,
              contractId,
              step: `artifact.${type}`,
              status: 'failed',
              progress: progressBase + Math.round((completedWeight / totalWeight) * 80),
              currentStep: `artifact.${type}`,
              error: 'Quality threshold not met or missing data',
            });
            if (generationConfig.enableFallbackOnError) {
              try {
                const fallbackData = getFallbackArtifactData(type, contractId);
                const existing = await prisma.artifact.findUnique({
                  where: { contractId_type: { contractId, type: type as any } },
                  select: { id: true },
                });
                if (!existing) {
                  await createOrUpdateArtifact({
                    contractId,
                    tenantId,
                    type: type as ArtifactType,
                    artifactData: { ...fallbackData, _fallback: true, _error: 'Quality threshold not met or missing data' },
                    validationStatus: 'needs_review',
                    modelUsed: null,
                    promptVersion: PROMPT_VERSION,
                  });
                  logger.info({ contractId, type, traceId: trace.traceId }, 'Fallback artifact stored');
                }
              } catch (fallbackError) {
                logger.warn({ contractId, type, fallbackError }, 'Failed to create fallback artifact');
              }
            }
            if (!generationConfig.continueOnPartialFailure) {
              throw new Error(`Artifact ${type} failed quality validation`);
            }
            continue;
          }

          try {
            const artifact = await retryWithBackoff(
              () => createOrUpdateArtifact({
                contractId,
                tenantId,
                type: type as ArtifactType,
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
                  regenerationAttempts: 0,
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
            successfulArtifactTypes.push(type);
            completedWeight += config?.weight || 1;
            logger.info({ contractId, artifactId: artifact.id, type, traceId: trace.traceId }, 'Artifact stored');
          } catch (saveError) {
            const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
            logger.error({ error: errorMsg, contractId, type, traceId: trace.traceId }, 'Failed to save artifact');
            failedArtifacts.push(type);
            await updateStep({
              tenantId,
              contractId,
              step: `artifact.${type}`,
              status: 'failed',
              progress: progressBase + Math.round((completedWeight / totalWeight) * 80),
              currentStep: `artifact.${type}`,
              error: errorMsg,
            });
            if (!generationConfig.continueOnPartialFailure) {
              throw saveError;
            }
            continue;
          }

          await updateStep({
            tenantId,
            contractId,
            step: `artifact.${type}`,
            status: 'completed',
            progress: progressBase + Math.round((completedWeight / totalWeight) * 80),
            currentStep: `artifact.${type}`,
          });
        }
      } else {
        const errorMsg = groupResult.reason instanceof Error ? groupResult.reason.message : String(groupResult.reason);
        logger.error({ error: errorMsg, contractId, group: group.name, types: group.types, traceId: trace.traceId }, `Failed to generate ${group.name} group after retries`);

        for (const type of group.types) {
          failedArtifacts.push(type);
          await updateStep({
            tenantId,
            contractId,
            step: `artifact.${type}`,
            status: 'failed',
            progress: progressBase + Math.round((completedWeight / totalWeight) * 80),
            currentStep: `artifact.${type}`,
            error: errorMsg,
          });

          if (generationConfig.enableFallbackOnError) {
            try {
              const fallbackData = getFallbackArtifactData(type, contractId);
              const existing = await prisma.artifact.findUnique({
                where: { contractId_type: { contractId, type: type as any } },
                select: { id: true },
              });
              if (!existing) {
                await createOrUpdateArtifact({
                  contractId,
                  tenantId,
                  type: type as ArtifactType,
                  artifactData: { ...fallbackData, _fallback: true, _error: errorMsg },
                  validationStatus: 'needs_review',
                  modelUsed: null,
                  promptVersion: PROMPT_VERSION,
                });
                logger.info({ contractId, type, traceId: trace.traceId }, 'Fallback artifact stored');
              }
            } catch (fallbackError) {
              logger.warn({ contractId, type, fallbackError }, 'Failed to create fallback artifact');
            }
          }
        }

        if (!generationConfig.continueOnPartialFailure) {
          throw groupResult.reason;
        }
      }

      await job.updateProgress(progressBase + Math.round((completedWeight / totalWeight) * 80));
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

    // Update top-level processing job status
    try {
      const processingJob = await prisma.processingJob.findFirst({
        where: { contractId, tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (processingJob) {
        await prisma.processingJob.updateMany({
          where: { id: processingJob.id, tenantId },
          data: {
            status: finalStatus,
            progress: 100,
            currentStep: failedArtifacts.length > 0 ? `completed with ${failedArtifacts.length} failed artifacts` : 'completed',
            updatedAt: new Date(),
          },
        });
      }
    } catch (processingJobError) {
      logger.warn({ contractId, error: processingJobError }, 'Failed to update top-level processing job status');
    }

    await job.updateProgress(100);

    await updateStep({
      tenantId,
      contractId,
      step: 'artifacts.generate',
      status: 'completed',
      progress: 100,
      currentStep: 'artifacts.generate',
    });

    if (finalStatus === 'COMPLETED' && contractText.trim().length > 100) {
      try {
        const queueService = getQueueService();
        await queueService.addJob(
          QUEUE_NAMES.RAG_INDEXING,
          JOB_NAMES.INDEX_CONTRACT,
          {
            contractId,
            tenantId,
            artifactIds,
            traceId: trace.traceId,
            requestId: job.data.requestId,
          },
          {
            priority: 15,
            jobId: `rag-index-${contractId}`,
          }
        );
        logger.info({ contractId, traceId: trace.traceId }, 'Queued RAG indexing after artifact generation');
      } catch (ragQueueError) {
        logger.warn({ contractId, ragQueueError }, 'Failed to queue RAG indexing after artifact generation');
      }
    }

    // ============ ENHANCEMENT: Populate ContractMetadata with AI insights ============
    try {
      const artifacts = await prisma.artifact.findMany({
        where: { contractId, tenantId },
        select: { type: true, data: true },
      });
      const overviewData: any = artifacts.find((a: any) => a.type === 'OVERVIEW')?.data || {};
      const riskData: any = artifacts.find((a: any) => a.type === 'RISK')?.data || {};
      const missingFields = getMissingMandatoryFields(detectedContractType, overviewData);
      const tabOrder = getTabPriorityOrder(detectedContractType);

      const mandatoryFieldsCount = contractTypeProfile.mandatoryFields.length;
      const foundMandatoryFields = mandatoryFieldsCount - missingFields.length;
      const completenessScore = mandatoryFieldsCount > 0
        ? Math.round((foundMandatoryFields / mandatoryFieldsCount) * 100)
        : 50;

      const complexityScore = Math.min(100, Math.round(
        (contractTypeProfile.clauseCategories.length * 5) +
        (contractTypeProfile.financialFields.length * 5) +
        (contractTypeProfile.riskCategories.length * 5) +
        (contractText.length > 10000 ? 20 : contractText.length > 5000 ? 10 : 0)
      ));

      const artifactSuccessRate = successfulArtifactTypes.length / (artifactTypes.length || 1);
      const dataQualityScore = Math.round(
        (completenessScore * 0.4) +
        ((contract.classificationConf || 0) * 100 * 0.3) +
        (artifactSuccessRate * 100 * 0.3)
      );

      const riskScore = typeof riskData.riskScore === 'number'
        ? Math.min(100, Math.max(0, riskData.riskScore))
        : (riskData.overallRisk === 'high' ? 75 : riskData.overallRisk === 'medium' ? 50 : 25);

      await prisma.contractMetadata.upsert({
        where: { contractId },
        create: {
          contractId,
          tenantId,
          updatedBy: 'artifact-generator-worker',
          dataQualityScore,
          riskScore,
          complexityScore,
          lastAiAnalysis: new Date(),
          aiAnalysisVersion: 'artifact-generator-v1',
          aiSummary: overviewData.summary || null,
          aiKeyInsights: overviewData.smartSuggestions || [],
          aiRiskFactors: riskData.risks || riskData.riskFactors || [],
          aiRecommendations: overviewData.smartSuggestions?.filter((s: any) => s.priority === 'high') || [],
          searchKeywords: overviewData.keyTerms || [],
          artifactSummary: {
            tabPriorityOrder: tabOrder,
            generatedArtifacts: successfulArtifactTypes,
            failedArtifacts,
            notApplicableArtifacts: skippedArtifacts,
            completenessScore,
            missingMandatoryFields: missingFields,
            contractType: detectedContractType,
            contractTypeConfidence: contract.classificationConf || 0,
            industryInsights: overviewData.industryInsights || null,
          },
          systemFields: {
            extractionVersion: '2.0',
            ocrMode: contract.ocrProvider || 'unknown',
            processedAt: new Date().toISOString(),
          },
        },
        update: {
          dataQualityScore,
          riskScore,
          complexityScore,
          lastAiAnalysis: new Date(),
          aiAnalysisVersion: 'artifact-generator-v1',
          aiSummary: overviewData.summary || undefined,
          aiKeyInsights: overviewData.smartSuggestions || [],
          aiRiskFactors: riskData.risks || riskData.riskFactors || [],
          aiRecommendations: overviewData.smartSuggestions?.filter((s: any) => s.priority === 'high') || [],
          searchKeywords: overviewData.keyTerms || [],
          artifactSummary: {
            tabPriorityOrder: tabOrder,
            generatedArtifacts: successfulArtifactTypes,
            failedArtifacts,
            notApplicableArtifacts: skippedArtifacts,
            completenessScore,
            missingMandatoryFields: missingFields,
            contractType: detectedContractType,
            contractTypeConfidence: contract.classificationConf || 0,
            industryInsights: overviewData.industryInsights || null,
          },
          updatedBy: 'artifact-generator-worker',
        },
      });

      logger.info({
        dataQualityScore,
        riskScore,
        complexityScore,
        completenessScore,
        missingMandatoryFields: missingFields.length,
      }, 'ContractMetadata populated with AI insights');
    } catch (metadataPopulateError) {
      logger.error({ error: metadataPopulateError }, 'Failed to populate ContractMetadata — AI insights may be missing');
    }

    // 5.5 Deterministic downstream plan
    const { plan } = buildProcessingPlan({ extractedText: contractText });

    // 6. Auto-queue downstream processing jobs
    const queueService = getQueueService();
    if (!hasCompleteFailure) {
      if (plan.ragIndexing) {
        // RAG indexing is already queued above; skip duplicate inline reindex
      }
      if (plan.metadataExtraction) {
        try {
          await queueService.addJob(
            QUEUE_NAMES.METADATA_EXTRACTION,
            JOB_NAMES.EXTRACT_METADATA,
            {
              contractId,
              tenantId,
              autoApply: true,
              autoApplyThreshold: 0.85,
              source: 'upload',
              priority: 'normal',
              traceId: trace.traceId,
              requestId: job.data.requestId,
            },
            {
              priority: 20,
              delay: 200,
              jobId: `metadata-${contractId}`,
            }
          );
          logger.info({ contractId, traceId: trace.traceId }, 'Queued metadata extraction after artifact generation');
        } catch (metadataError) {
          logger.warn({ contractId, metadataError }, 'Failed to queue metadata extraction');
        }
      }
      if (plan.categorization) {
        try {
          await queueService.addJob(
            QUEUE_NAMES.CATEGORIZATION,
            JOB_NAMES.CATEGORIZE_CONTRACT,
            {
              contractId,
              tenantId,
              autoApply: true,
              autoApplyThreshold: 0.75,
              source: 'upload',
              priority: 'normal',
              traceId: trace.traceId,
              requestId: job.data.requestId,
            },
            {
              priority: 25,
              delay: 300,
              jobId: `categorize-${contractId}`,
            }
          );
          logger.info({ contractId, traceId: trace.traceId }, 'Queued categorization after artifact generation');
        } catch (categorizationError) {
          logger.warn({ contractId, categorizationError }, 'Failed to queue categorization');
        }
      }
    }

    // Publish completion event
    try {
      await redisEventBus.publish(RedisEvents.PROCESSING_COMPLETED, {
        contractId,
        tenantId,
        jobId: job.id,
        status: hasCompleteFailure ? 'failed' : (hasPartialSuccess ? 'partial' : 'completed'),
        artifactsCreated: artifactIds.length,
        failedArtifacts: failedArtifacts.length > 0 ? failedArtifacts : undefined,
      }, 'artifact-generator-worker');
    } catch (eventError) {
      logger.warn({ contractId, eventError }, 'Failed to publish completion event');
    }

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
 * Build the shared PromptContext once per contract. This includes contract-type
 * hints and any Azure Document Intelligence structured data attached to the contract.
 */
function buildArtifactPromptContext(
  contractText: string,
  contractType?: string,
  contract?: any
): PromptContext {
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

  const aiMetadata = contract?.aiMetadata || {};
  const diSource = aiMetadata?.ocrStructuredMeta?.source;
  const diConfidence = aiMetadata?.ocrStructuredMeta?.confidence;
  const diTables = aiMetadata?.diTables;
  const diKeyValuePairs = aiMetadata?.diKeyValuePairs;
  const diContractFields = aiMetadata?.diContractFields;
  const diInvoiceFields = aiMetadata?.diInvoiceFields;
  const diParagraphs = aiMetadata?.diParagraphs;
  const diHandwrittenSpans = aiMetadata?.diHandwrittenSpans;
  const diDetectedLanguages = aiMetadata?.diDetectedLanguages;
  const diSelectionMarks = aiMetadata?.diSelectionMarks;
  const diBarcodes = aiMetadata?.diBarcodes;
  const diFormulas = aiMetadata?.diFormulas;

  return {
    contractText,
    contractType,
    contractTypeHints: contractTypeHints || undefined,
    ...(diSource ? { diConfidence } : {}),
    ...(Array.isArray(diTables) && diTables.length > 0 ? { diTables } : {}),
    ...(Array.isArray(diKeyValuePairs) && diKeyValuePairs.length > 0 ? { diKeyValuePairs } : {}),
    ...(diContractFields ? { diContractFields } : {}),
    ...(diInvoiceFields ? { diInvoiceFields } : {}),
    ...(Array.isArray(diParagraphs) && diParagraphs.length > 0
      ? {
          diDocumentStructure: diParagraphs
            .filter((p: any) => p.role && ['title', 'sectionHeading'].includes(p.role))
            .map((p: any) => ({ content: (p.content || '').slice(0, 200), role: p.role })),
        }
      : {}),
    ...(Array.isArray(diHandwrittenSpans) && diHandwrittenSpans.length > 0
      ? {
          diHandwritingInfo: {
            hasHandwriting: true,
            handwrittenSpans: diHandwrittenSpans,
            handwrittenSpanCount: diHandwrittenSpans.length,
          },
        }
      : {}),
    ...(Array.isArray(diDetectedLanguages) && diDetectedLanguages.length > 0 ? { diDetectedLanguages } : {}),
    ...(Array.isArray(diSelectionMarks) && diSelectionMarks.length > 0 ? { diSelectionMarks } : {}),
    ...(Array.isArray(diBarcodes) && diBarcodes.length > 0 ? { diBarcodes } : {}),
    ...(Array.isArray(diFormulas) && diFormulas.length > 0 ? { diFormulas } : {}),
  };
}

/**
 * Generate all artifact data for a group in a single OpenAI call.
 * The contract text is sent once, and the response is split per artifact type.
 */
async function generateGroupData(
  group: ArtifactGroup,
  promptCtx: PromptContext,
  contractId: string,
  tenantId: string,
  modelName: string
): Promise<Record<string, any>> {
  const openai = await getOpenAIClient(modelName);
  if (!openai) {
    logger.warn('OPENAI_API_KEY not configured, cannot generate group');
    throw new Error('OpenAI client not configured');
  }

  const groupedPrompt = buildGroupedPrompt(group, promptCtx);
  if (!groupedPrompt) {
    throw new Error(`No prompts built for group ${group.name}`);
  }

  const systemPrompt = getSystemPrompt();

  logger.info({ group: group.name, contractId, model: modelName, textLength: promptCtx.contractText.length }, 'Calling OpenAI for artifact group');

  const response = await openaiBreaker.execute(() =>
    openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: groupedPrompt },
      ],
      max_tokens: 16384,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })
  ) as { choices: Array<{ message: { content: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response');

  const parsed = safeParseJSON(content, group.name);
  if (!parsed) {
    throw new Error('Failed to parse JSON response');
  }

  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const cost = estimateTokenCost(modelName, promptTokens, completionTokens);

  costTracker.addCost(contractId, tenantId, cost);

  logAIUsage({
    model: modelName,
    endpoint: 'openai',
    feature: `artifact-generation:${group.name}`,
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    latencyMs: 0,
    success: true,
    tenantId,
    contractId,
  }).catch(() => {}); // fire-and-forget

  const groupResult = splitGroupedResponse(group, parsed);

  for (const type of group.types) {
    const data = groupResult[type];
    if (data && typeof data === 'object') {
      data._meta = {
        generatedAt: new Date().toISOString(),
        aiGenerated: true,
        model: modelName,
        antiHallucinationEnabled: true,
        promptVersion: PROMPT_VERSION,
        tokensUsed: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        estimatedCost: cost,
        group: group.name,
      };
    }
  }

  logger.info({ group: group.name, contractId, model: modelName, tokensUsed: promptTokens + completionTokens, cost: cost.toFixed(6) }, 'AI artifact group generated successfully');

  return groupResult;
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
