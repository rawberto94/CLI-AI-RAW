import { Job } from 'bullmq';
import getClient from 'clients-db';
import { getQueueService } from '../../utils/src/queue/queue-service';
import { QUEUE_NAMES, GenerateArtifactsJobData } from '../../utils/src/queue/contract-queue';
import pino from 'pino';

const logger = pino({ name: 'artifact-generator-worker' });
const prisma = getClient();

interface ArtifactResult {
  artifactsCreated: number;
  artifactIds: string[];
}

/**
 * Artifact Generation Worker
 * Generates AI-powered artifacts for contracts
 */
export async function generateArtifactsJob(
  job: Job<GenerateArtifactsJobData>
): Promise<ArtifactResult> {
  const { contractId, tenantId, contractText } = job.data;

  logger.info(
    { contractId, tenantId, jobId: job.id },
    'Starting artifact generation'
  );

  const artifactIds: string[] = [];

  try {
    await job.updateProgress(5);

    // Validate contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Define artifacts to generate
    const artifactTypes = [
      { type: 'overview', weight: 15 },
      { type: 'key_clauses', weight: 20 },
      { type: 'financial_analysis', weight: 25 },
      { type: 'risk_assessment', weight: 20 },
      { type: 'compliance_check', weight: 20 },
    ];

    let progressBase = 10;

    // Generate each artifact
    for (const { type, weight } of artifactTypes) {
      try {
        logger.info({ contractId, type }, `Generating ${type} artifact`);

        // Simulate AI generation (replace with actual OpenAI call)
        const artifactData = await generateArtifactData(type, contractText, contractId);

        // Save artifact to database
        const artifact = await prisma.artifact.create({
          data: {
            contractId,
            tenantId,
            type,
            data: artifactData,
            validationStatus: 'valid',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        artifactIds.push(artifact.id);
        logger.info({ contractId, artifactId: artifact.id, type }, 'Artifact created');

        progressBase += weight;
        await job.updateProgress(progressBase);
      } catch (error) {
        logger.error({ error, contractId, type }, `Failed to generate ${type} artifact`);
        // Continue with other artifacts even if one fails
      }
    }

    // Update contract status to completed
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    logger.info(
      { contractId, artifactCount: artifactIds.length },
      'Artifact generation completed'
    );

    return {
      artifactsCreated: artifactIds.length,
      artifactIds,
    };
  } catch (error) {
    logger.error({ error, contractId, jobId: job.id }, 'Artifact generation failed');

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'FAILED',
        updatedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Generate artifact data (placeholder for actual AI generation)
 */
async function generateArtifactData(
  type: string,
  contractText: string,
  contractId: string
): Promise<Record<string, any>> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  // This would be replaced with actual OpenAI API calls
  const artifactTemplates: Record<string, any> = {
    overview: {
      summary: `AI-generated summary for contract ${contractId}`,
      contractType: 'Service Agreement',
      parties: ['Party A', 'Party B'],
      effectiveDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      keyTerms: ['Term 1', 'Term 2', 'Term 3'],
    },
    key_clauses: {
      clauses: [
        {
          title: 'Payment Terms',
          content: 'Payment terms extracted from contract',
          importance: 'high',
        },
        {
          title: 'Termination Clause',
          content: 'Termination conditions',
          importance: 'high',
        },
        {
          title: 'Liability Limitation',
          content: 'Liability limitations',
          importance: 'medium',
        },
      ],
    },
    financial_analysis: {
      totalValue: 1000000,
      currency: 'USD',
      paymentSchedule: 'Monthly',
      costBreakdown: [
        { category: 'Services', amount: 800000 },
        { category: 'Support', amount: 200000 },
      ],
    },
    risk_assessment: {
      overallRisk: 'Medium',
      risks: [
        {
          category: 'Financial',
          level: 'Low',
          description: 'Payment terms are standard',
        },
        {
          category: 'Legal',
          level: 'Medium',
          description: 'Some ambiguous clauses detected',
        },
      ],
    },
    compliance_check: {
      compliant: true,
      checks: [
        { regulation: 'GDPR', status: 'compliant' },
        { regulation: 'SOC 2', status: 'compliant' },
      ],
      issues: [],
    },
  };

  return artifactTemplates[type] || { type, generated: true };
}

/**
 * Register artifact generator worker
 */
export function registerArtifactGeneratorWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker<GenerateArtifactsJobData, ArtifactResult>(
    QUEUE_NAMES.ARTIFACT_GENERATION,
    generateArtifactsJob,
    {
      concurrency: 5, // Process 5 artifact jobs simultaneously
      limiter: {
        max: 20,
        duration: 60000, // Max 20 jobs per minute (OpenAI rate limiting)
      },
    }
  );

  logger.info('Artifact generator worker registered');

  return worker;
}
