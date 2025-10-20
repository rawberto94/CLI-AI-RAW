/**
 * Artifact Generation Trigger
 *
 * This module handles triggering artifact generation after contract upload.
 * It can work in two modes:
 * 1. Direct service call (for development)
 * 2. BullMQ queue (for production)
 */

// No Prisma - using mock database for development

export interface ArtifactGenerationOptions {
  contractId: string;
  tenantId: string;
  filePath: string;
  mimeType: string;
  useQueue?: boolean; // If true, use BullMQ; if false, direct call
}

/**
 * Trigger artifact generation for a contract
 */
export async function triggerArtifactGeneration(
  options: ArtifactGenerationOptions
): Promise<{ jobId: string; status: string }> {
  const {
    contractId,
    tenantId,
    filePath,
    mimeType,
    useQueue = false,
  } = options;

  console.log(`🎯 Triggering artifact generation for contract ${contractId}`);

  if (useQueue) {
    // Production mode: Use BullMQ
    return triggerViaQueue(options);
  } else {
    // Development mode: Direct service call
    return triggerDirectly(options);
  }
}

/**
 * Trigger via BullMQ (production)
 */
async function triggerViaQueue(
  options: ArtifactGenerationOptions
): Promise<{ jobId: string; status: string }> {
  const { contractId, tenantId, filePath, mimeType } = options;

  try {
    const { Queue } = await import("bullmq");
    const { default: Redis } = await import("ioredis");

    const connection = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: null,
    });

    const processingQueue = new Queue("contract-processing", {
      connection,
    });

    const job = await processingQueue.add(
      "generate-artifacts",
      {
        contractId,
        tenantId,
        filePath,
        mimeType,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    console.log(`✅ Queued artifact generation job: ${job.id}`);

    return {
      jobId: job.id as string,
      status: "queued",
    };
  } catch (error) {
    console.error("❌ Failed to queue artifact generation:", error);
    // Fallback to direct call
    console.log("⚠️  Falling back to direct service call");
    return triggerDirectly(options);
  }
}

/**
 * Trigger directly (development/fallback)
 */
async function triggerDirectly(
  options: ArtifactGenerationOptions
): Promise<{ jobId: string; status: string }> {
  const { contractId, tenantId, filePath, mimeType } = options;

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`🔄 Starting direct artifact generation (jobId: ${jobId})`);

  // Run in background - don't await
  generateArtifactsInBackground(
    contractId,
    tenantId,
    jobId,
    filePath,
    mimeType
  ).catch((error) => {
    console.error(`❌ Background artifact generation failed:`, error);
  });

  return {
    jobId,
    status: "processing",
  };
}

/**
 * Background artifact generation (async)
 */
async function generateArtifactsInBackground(
  contractId: string,
  tenantId: string,
  jobId: string,
  filePath: string,
  mimeType: string
): Promise<void> {
  try {
    console.log(
      `📊 Starting enhanced artifact generation for contract: ${contractId}`
    );
    console.log(`📂 File path: ${filePath}`);
    console.log(`📋 MIME type: ${mimeType}`);

    // Use the enhanced artifact generator
    const { generateEnhancedArtifacts } = await import(
      "./artifact-generator-enhanced"
    );

    const analysisResult = await generateEnhancedArtifacts(
      contractId,
      tenantId,
      filePath,
      mimeType
    );

    console.log(`✅ Enhanced artifacts generated for ${contractId}:`, {
      riskScore: analysisResult.risk.overallScore,
      opportunityScore: analysisResult.opportunities.overallScore,
      clausesFound: analysisResult.clauses.length,
      riskFactors: analysisResult.risk.riskFactors.length,
    });

    // Emit event for RAG integration
    await emitArtifactsGeneratedEvent(contractId, tenantId, analysisResult);

    // Trigger RAG indexing
    await triggerRAGIndexing(contractId, tenantId, analysisResult);
  } catch (error) {
    console.error(
      `❌ Enhanced artifact generation failed for ${contractId}:`,
      error
    );
    throw error;
  }
}

/**
 * Emit artifacts generated event
 */
async function emitArtifactsGeneratedEvent(
  contractId: string,
  tenantId: string,
  analysisResult: any
): Promise<void> {
  try {
    const eventModule = await resolveEventModule();
    if (!eventModule) {
      console.warn(
        "⚠️  Skipping event emission: data-orchestration event bus not available"
      );
      return;
    }

    const { eventBus, Events } = eventModule;

    const artifacts = convertAnalysisToArtifacts(analysisResult);

    eventBus.emit(Events.ARTIFACTS_GENERATED, {
      contractId,
      tenantId,
      userId: "system",
      artifacts,
      timestamp: new Date(),
    });

    console.log(`📢 Emitted ARTIFACTS_GENERATED event for ${contractId}`);
    console.log(
      `   → Will trigger: Analytical Sync, RAG Indexing, Data Standardization, Taxonomy, Intelligence`
    );
  } catch (error) {
    console.error(`❌ Failed to emit artifacts generated event:`, error);
    // Don't throw - event emission failure shouldn't break the flow
  }
}

/**
 * Trigger RAG indexing
 */
async function triggerRAGIndexing(
  contractId: string,
  tenantId: string,
  analysisResult: any
): Promise<void> {
  try {
    const ragModule = await resolveRagIntegrationService();
    if (!ragModule) {
      console.log("ℹ️  RAG integration service unavailable; skipping indexing");
      return;
    }

    const { ragIntegrationService } = ragModule;

    console.log(`🔍 Triggering RAG indexing for ${contractId}`);

    const artifacts = convertAnalysisToArtifacts(analysisResult);

    // Trigger indexing (non-blocking)
    ragIntegrationService
      .indexContract(contractId, tenantId, "system", artifacts)
      .then((result) => {
        if (result.success) {
          console.log(`✅ RAG indexing completed for ${contractId}:`, {
            vectorIndexed: result.vectorIndexed,
            graphBuilt: result.graphBuilt,
            multiModalProcessed: result.multiModalProcessed,
            processingTime: result.processingTime,
          });
        } else {
          console.warn(
            `⚠️  RAG indexing failed for ${contractId}:`,
            result.error
          );
        }
      })
      .catch((error) => {
        console.error(`❌ RAG indexing error for ${contractId}:`, error);
      });
  } catch (error) {
    console.error(`❌ Failed to trigger RAG indexing:`, error);
    // Don't throw - RAG failure shouldn't break artifact generation
  }
}

/**
 * Convert analysis result to artifact format
 */
function convertAnalysisToArtifacts(analysisResult: any): any[] {
  const artifacts: any[] = [];

  // Add risk analysis as artifact
  if (analysisResult.risk) {
    artifacts.push({
      type: "risk_analysis",
      content: JSON.stringify(analysisResult.risk),
      metadata: {
        overallScore: analysisResult.risk.overallScore,
        riskFactors: analysisResult.risk.riskFactors?.length || 0,
      },
    });
  }

  // Add opportunities as artifact
  if (analysisResult.opportunities) {
    artifacts.push({
      type: "opportunities",
      content: JSON.stringify(analysisResult.opportunities),
      metadata: {
        overallScore: analysisResult.opportunities.overallScore,
        opportunitiesCount:
          analysisResult.opportunities.opportunities?.length || 0,
      },
    });
  }

  // Add clauses as artifacts
  if (analysisResult.clauses && Array.isArray(analysisResult.clauses)) {
    analysisResult.clauses.forEach((clause: any, index: number) => {
      artifacts.push({
        type: "clause",
        id: `clause_${index}`,
        content: clause.text || clause.content || "",
        metadata: {
          clauseType: clause.type || "general",
          riskLevel: clause.riskLevel || "low",
        },
      });
    });
  }

  // Add parties as artifacts
  if (analysisResult.parties && Array.isArray(analysisResult.parties)) {
    analysisResult.parties.forEach((party: any) => {
      artifacts.push({
        type: "parties",
        content: party.name || party,
        metadata: {
          role: party.role || "unknown",
        },
      });
    });
  }

  // Add contract metadata
  if (analysisResult.metadata) {
    artifacts.push({
      type: "metadata",
      content: JSON.stringify(analysisResult.metadata),
      metadata: analysisResult.metadata,
    });
  }

  return artifacts;
}

async function resolveEventModule(): Promise<{
  eventBus: any;
  Events: any;
} | null> {
  const candidates = ["data-orchestration/events", "data-orchestration"];

  for (const specifier of candidates) {
    try {
      const module = await import(specifier);
      if (module?.eventBus && module?.Events) {
        return { eventBus: module.eventBus, Events: module.Events };
      }
    } catch (error) {
      // Ignore and try next candidate
    }
  }

  return null;
}

async function resolveRagIntegrationService(): Promise<{
  ragIntegrationService: any;
} | null> {
  const candidates = ["data-orchestration/services", "data-orchestration"];

  for (const specifier of candidates) {
    try {
      const module = await import(specifier);
      if (module?.ragIntegrationService) {
        return { ragIntegrationService: module.ragIntegrationService };
      }
    } catch (error) {
      // Ignore and try next candidate
    }
  }

  return null;
}
