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
    console.log(`📊 Starting enhanced artifact generation for contract: ${contractId}`);
    console.log(`📂 File path: ${filePath}`);
    console.log(`📋 MIME type: ${mimeType}`);

    // Use the enhanced artifact generator
    const { generateEnhancedArtifacts } = await import("./artifact-generator-enhanced");
    
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
      riskFactors: analysisResult.risk.riskFactors.length
    });

  } catch (error) {
    console.error(`❌ Enhanced artifact generation failed for ${contractId}:`, error);
    throw error;
  }
}
