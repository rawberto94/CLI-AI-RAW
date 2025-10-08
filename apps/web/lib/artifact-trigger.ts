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
    console.log(`📊 Starting artifact generation for contract: ${contractId}`);
    console.log(`📂 File path: ${filePath}`);
    console.log(`📋 MIME type: ${mimeType}`);

    // Check if we have OpenAI API key - use real LLM or fallback to mocks
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (hasOpenAI) {
      console.log("🧠 Using REAL LLM generation with OpenAI API");
      try {
        // Use the no-dependencies version that calls OpenAI API directly
        const { generateArtifactsNoDeps } = await import(
          "./artifact-generator-no-deps"
        );
        await generateArtifactsNoDeps(contractId, jobId, filePath, mimeType);
        console.log(`✅ Real LLM artifacts generated for ${contractId}`);
        return;
      } catch (error) {
        console.error(
          "❌ Real LLM generation failed, falling back to mocks:",
          error
        );
        // Fall through to mock generation
      }
    } else {
      console.log("💭 No OPENAI_API_KEY found, using mock generation");
    }

    // Fallback to mock artifacts (simplified - no database required)
    console.log(`⚠️  Using MOCK generation for ${contractId}`);
    console.log(`🎉 Mock artifacts would be generated here`);
  } catch (error) {
    console.error(`❌ Artifact generation failed for ${contractId}:`, error);
    throw error;
  }
}
