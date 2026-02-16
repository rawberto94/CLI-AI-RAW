import { JobType, getQueueService } from '@repo/utils/queue/queue-service';
import { JOB_NAMES, QUEUE_NAMES, AgentOrchestrationJobData } from '@repo/utils/queue/contract-queue';
import clientsDb from 'clients-db';
import pino from 'pino';

import { processScheduledTrigger } from './autonomous-scheduler';
import { ensureProcessingJob, updateStep } from './workflow/processing-job';
import { getTraceContextFromJobData } from './observability/trace';
import { getWorkerConcurrency, getWorkerLimiter } from './config/worker-runtime';
import { getContractProfile, getRelevantArtifacts, ContractType } from './contract-type-profiles';
import { getMultiAgentCoordinator } from './agents/multi-agent-coordinator';
import { getGoalOrientedReasoner } from './agents/goal-oriented-reasoner';
import { getProactiveRiskDetector } from './agents/proactive-risk-detector';
import { getUserFeedbackLearner } from './agents/user-feedback-learner';
import { getABTestingEngine } from './agents/ab-testing-engine';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

const logger = pino({ name: 'agent-orchestrator-worker' });

type AgentProposal = {
  agent: 'metadata-agent' | 'categorization-agent' | 'rag-agent' | 'artifacts-agent';
  tool:
    | 'metadata.extract'
    | 'categorization.run'
    | 'rag.index'
    | 'artifacts.generate';
  reason: string;
  priority: number;
  job?: { queue: string; name: string; data: Record<string, unknown>; opts?: { jobId?: string; delay?: number; priority?: number } };
};

type AgentDecision = {
  decidedAt: string;
  proposals: AgentProposal[];
  enqueued: Array<{ queue: string; name: string; jobId?: string | null }>;
  nextTickEnqueued?: { jobId?: string | null; delayMs: number };
  done: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function stepIsTerminal(status: unknown): boolean {
  return status === 'completed' || status === 'skipped' || status === 'failed';
}

function stepIsRunning(status: unknown): boolean {
  return status === 'running';
}

function getStepStatus(steps: any, step: string): unknown {
  return steps?.[step]?.status;
}

function getContractTypeFromDb(contract: any): ContractType | null {
  const t = contract?.contractType;
  if (typeof t === 'string' && t.length > 0) return t as ContractType;
  return null;
}

async function computeArtifactNeed(args: { contractId: string; tenantId: string; contractType: ContractType | null }) {
  const { contractId, tenantId, contractType } = args;

  // If we don't know the type yet, default to not forcing artifacts.
  if (!contractType) {
    return { requiredMissing: [] as string[] };
  }

  const profile = getContractProfile(contractType);
  const relevant = new Set(getRelevantArtifacts(contractType));
  const required = Object.entries(profile.artifactRelevance)
    .filter(([type, relevance]) => relevance === 'required' && relevant.has(type as any))
    .map(([type]) => type);

  const existing = await prisma.artifact.findMany({
    where: { contractId, tenantId },
    select: { type: true },
  });

  const have = new Set(existing.map((a: any) => String(a.type)));
  const missing = required.filter((t) => !have.has(String(t)));

  return { requiredMissing: missing };
}

export async function runAgentOrchestrationJob(
  job: JobType<AgentOrchestrationJobData>
): Promise<{ done: boolean; iteration: number }> {
  // ===== AUTONOMOUS TRIGGER JOBS =====
  // Repeatable cron jobs arrive with autonomous:true — delegate to scheduler
  if ((job.data as any).autonomous && (job.data as any).goalType) {
    const { triggerName, goalType, trigger } = job.data as any;
    logger.info({ goalType, triggerName, jobId: job.id }, '🤖 Autonomous trigger tick');
    try {
      const result = await processScheduledTrigger(triggerName, goalType, trigger);
      logger.info({ goalType, ...result }, '🤖 Autonomous trigger processed');
    } catch (error) {
      logger.error({ goalType, error: (error as Error).message }, 'Autonomous trigger failed');
    }
    return { done: true, iteration: 0 };
  }

  const { contractId, tenantId } = job.data;
  const iteration = Number(job.data.iteration ?? 0);
  const trace = getTraceContextFromJobData(job.data);

  logger.info({ contractId, tenantId, iteration, jobId: job.id, traceId: trace.traceId }, 'Agent tick starting');

  await ensureProcessingJob({
    tenantId,
    contractId,
    queueId: job.id ? String(job.id) : undefined,
    traceId: trace.traceId,
  });

  await updateStep({
    tenantId,
    contractId,
    step: 'agent.orchestrator',
    status: 'running',
    progress: 1,
    currentStep: 'agent.orchestrator',
  });

  const processingJob = await prisma.processingJob.findFirst({
    where: { tenantId, contractId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, checkpointData: true },
  });

  const checkpoint = (processingJob?.checkpointData ?? {}) as any;
  const steps = checkpoint.steps ?? {};
  const plan = checkpoint.plan ?? null;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      tenantId: true,
      contractType: true,
      rawText: true,
      status: true,
      totalValue: true,
      annualValue: true,
      effectiveDate: true,
      expirationDate: true,
      supplierName: true,
      counterparty: true,
      vendor: true,
      contractTitle: true,
      autoRenewalEnabled: true,
      department: true,
      renewalInitiatedAt: true,
    },
  });

  const contractType = getContractTypeFromDb(contract);

  const proposals: AgentProposal[] = [];

  // ===== NEXT-LEVEL AGENT SYSTEMS =====
  
  // 1. Goal-Oriented Reasoning: Detect user intent FIRST
  let userIntent: any = null;
  let goalPlan: any = null;
  
  if (!checkpoint.intent && iteration === 0) {
    try {
      const reasoner = getGoalOrientedReasoner();
      const userQuery = job.data.userQuery || 'Process contract';
      const userRole = job.data.userRole || 'user';
      const previousActions = checkpoint.agent?.history?.map((h: any) => h.enqueued.map((e: any) => e.name)).flat() || [];
      
      userIntent = await reasoner.detectIntent({
        userQuery,
        contractType: contractType || 'service_agreement',
        userRole,
        previousActions,
        contractMetadata: {
          hasRenewalDate: false,
          hasFinancialTerms: false,
          urgency: 'medium',
        },
      });
      
      logger.info({ 
        contractId, 
        primaryGoal: userIntent.primaryGoal, 
        confidence: userIntent.confidence.toFixed(2),
        urgency: userIntent.context.urgency,
      }, '🎯 User intent detected');
      
      // Generate goal-based plan
      const allArtifactTypes = ['OVERVIEW', 'CLAUSES', 'OBLIGATIONS', 'FINANCIAL', 'PRICING_ANALYSIS', 
                                'RISK', 'COMPLIANCE', 'AMENDMENTS', 'NEGOTIATION_POINTS', 'RENEWAL'];
      goalPlan = reasoner.generateGoalPlan(userIntent, allArtifactTypes);
      
      logger.info({
        contractId,
        goal: goalPlan.goal,
        prioritizedCount: goalPlan.prioritizedArtifacts.length,
        skippedCount: goalPlan.skipArtifacts.length,
        estimatedValue: goalPlan.estimatedValue,
      }, '📋 Goal-based execution plan created');
      
      // Store in checkpoint
      checkpoint.intent = userIntent;
      checkpoint.goalPlan = goalPlan;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Intent detection failed, continuing with default workflow');
    }
  } else if (checkpoint.intent) {
    // Load from checkpoint
    userIntent = checkpoint.intent;
    goalPlan = checkpoint.goalPlan;
  }

  // 2. Multi-Agent Coordination: Let specialists negotiate BEFORE generation
  let executionPlan: any = null;
  let negotiation: any = null;
  
  if (!checkpoint.executionPlan && userIntent && goalPlan && contractType) {
    try {
      const coordinator = getMultiAgentCoordinator();
      const contractText = typeof contract?.rawText === 'string' ? contract.rawText : '';
      
      // Get proposals from all specialist agents
      negotiation = await coordinator.analyzeContract(
        contractId,
        contractType,
        goalPlan.prioritizedArtifacts.map((a: any) => a.artifactType),
        contractText
      );
      
      logger.info({
        contractId,
        agentCount: negotiation.proposals.length,
        consensusReached: negotiation.consensusReached,
        conflictCount: negotiation.conflicts.length,
      }, '🤝 Multi-agent negotiation completed');
      
      // Create optimized execution plan
      executionPlan = await coordinator.createExecutionPlan(negotiation);
      
      logger.info({
        contractId,
        phaseCount: executionPlan.phases.length,
        totalCost: executionPlan.totalCost.toFixed(2),
        totalTime: executionPlan.totalTime,
        optimizationScore: executionPlan.optimizationScore.toFixed(2),
      }, '⚡ Optimized execution plan created');
      
      // Store in checkpoint
      checkpoint.negotiation = negotiation;
      checkpoint.executionPlan = executionPlan;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Multi-agent coordination failed, continuing with default workflow');
    }
  } else if (checkpoint.executionPlan) {
    // Load from checkpoint
    executionPlan = checkpoint.executionPlan;
    negotiation = checkpoint.negotiation;
  }

  // ===== STANDARD SPECIALIST AGENTS =====

  // Specialist: Metadata Agent
  if (plan?.metadataExtraction) {
    const s = getStepStatus(steps, 'metadata.extract');
    if (!stepIsTerminal(s) && !stepIsRunning(s)) {
      proposals.push({
        agent: 'metadata-agent',
        tool: 'metadata.extract',
        reason: 'Plan requires metadata extraction and it has not completed yet.',
        priority: 20,
        job: {
          queue: QUEUE_NAMES.METADATA_EXTRACTION,
          name: JOB_NAMES.EXTRACT_METADATA,
          data: {
            contractId,
            tenantId,
            autoApply: true,
            autoApplyThreshold: 0.85,
            source: 'upload',
            priority: 'normal',
            traceId: trace.traceId,
            requestId: job.data.requestId,
          },
          opts: { jobId: `metadata-${contractId}`, delay: 1000, priority: 20 },
        },
      });
    }
  }

  // Specialist: Categorization Agent
  if (plan?.categorization) {
    const s = getStepStatus(steps, 'categorization.run');
    if (!stepIsTerminal(s) && !stepIsRunning(s)) {
      proposals.push({
        agent: 'categorization-agent',
        tool: 'categorization.run',
        reason: 'Plan requires categorization and it has not completed yet.',
        priority: 25,
        job: {
          queue: QUEUE_NAMES.CATEGORIZATION,
          name: JOB_NAMES.CATEGORIZE_CONTRACT,
          data: {
            contractId,
            tenantId,
            autoApply: true,
            autoApplyThreshold: 0.75,
            source: 'upload',
            priority: 'normal',
            traceId: trace.traceId,
            requestId: job.data.requestId,
          },
          opts: { jobId: `categorize-${contractId}`, delay: 1500, priority: 25 },
        },
      });
    }
  }

  // Specialist: RAG Agent
  if (plan?.ragIndexing) {
    const s = getStepStatus(steps, 'rag.indexing');
    if (!stepIsTerminal(s) && !stepIsRunning(s)) {
      proposals.push({
        agent: 'rag-agent',
        tool: 'rag.index',
        reason: 'Plan requires RAG indexing and it has not completed yet.',
        priority: 15,
        job: {
          queue: QUEUE_NAMES.RAG_INDEXING,
          name: JOB_NAMES.INDEX_CONTRACT,
          data: {
            contractId,
            tenantId,
            artifactIds: [],
            traceId: trace.traceId,
            requestId: job.data.requestId,
          },
          opts: { jobId: `rag-${contractId}`, delay: 500, priority: 15 },
        },
      });
    }
  }

  // Specialist: Artifacts Agent (deterministic quality gate)
  // If required artifacts are missing, trigger artifact generation.
  const artifactNeed = await computeArtifactNeed({ contractId, tenantId, contractType });
  if (artifactNeed.requiredMissing.length > 0) {
    const s = getStepStatus(steps, 'artifacts.generate');
    if (!stepIsTerminal(s) && !stepIsRunning(s)) {
      const contractText = typeof contract?.rawText === 'string' ? contract.rawText : '';
      if (contractText.length > 0) {
        proposals.push({
          agent: 'artifacts-agent',
          tool: 'artifacts.generate',
          reason: `Missing required artifacts for type ${contractType}: ${artifactNeed.requiredMissing.join(', ')}`,
          priority: 30,
          job: {
            queue: QUEUE_NAMES.ARTIFACT_GENERATION,
            name: JOB_NAMES.GENERATE_ARTIFACTS,
            data: {
              contractId,
              tenantId,
              contractText,
              priority: 'medium',
              traceId: trace.traceId,
              requestId: job.data.requestId,
            },
            opts: { jobId: `artifacts-${contractId}`, delay: 2000, priority: 30 },
          },
        });
      }
    }
  }

  // Enqueue the chosen actions (deterministic arbitration: priority asc)
  proposals.sort((a, b) => a.priority - b.priority);
  const maxActionsThisTick = Number.parseInt(process.env.AGENT_MAX_ACTIONS_PER_TICK || '3', 10);
  const chosen = proposals.slice(0, Math.max(0, maxActionsThisTick));

  const queueService = getQueueService();
  const enqueued: Array<{ queue: string; name: string; jobId?: string | null }> = [];

  for (const p of chosen) {
    if (!p.job) continue;

    try {
      const j = await queueService.addJob(p.job.queue, p.job.name, p.job.data as any, {
        priority: p.job.opts?.priority,
        delay: p.job.opts?.delay,
        jobId: p.job.opts?.jobId,
      });
      enqueued.push({ queue: p.job.queue, name: p.job.name, jobId: j?.id ?? null });
    } catch (error) {
      logger.warn({ error, proposal: p }, 'Failed to enqueue proposal (continuing)');
      enqueued.push({ queue: p.job.queue, name: p.job.name, jobId: null });
    }
  }

  // Decide whether we're done.
  const plannedSteps = [
    plan?.ragIndexing ? 'rag.indexing' : null,
    plan?.metadataExtraction ? 'metadata.extract' : null,
    plan?.categorization ? 'categorization.run' : null,
  ].filter(Boolean) as string[];

  const allPlannedTerminal = plannedSteps.every((s) => stepIsTerminal(getStepStatus(steps, s)));
  const artifactsOk = artifactNeed.requiredMissing.length === 0;
  
  // 3. Proactive Risk Detection: Analyze AFTER artifacts are generated
  let riskAnalysis: any = null;
  
  if (artifactsOk && !checkpoint.riskAnalysis) {
    try {
      const detector = getProactiveRiskDetector();
      const contractText = typeof contract?.rawText === 'string' ? contract.rawText : '';
      
      // Get all generated artifacts
      const artifacts = await prisma.artifact.findMany({
        where: { contractId, tenantId },
        select: { type: true, data: true },
      });
      
      const artifactsMap: Record<string, any> = {};
      for (const artifact of artifacts) {
        artifactsMap[String(artifact.type)] = artifact.data;
      }
      
      riskAnalysis = await detector.analyzeContract(
        contractId,
        tenantId,
        contractType || 'service_agreement',
        contractText,
        artifactsMap
      );
      
      logger.info({
        contractId,
        riskScore: riskAnalysis.overallRiskScore,
        criticalCount: riskAnalysis.criticalCount,
        highCount: riskAnalysis.highCount,
        actionRequired: riskAnalysis.actionRequired,
        escalationNeeded: riskAnalysis.escalationNeeded,
      }, '🚨 Proactive risk analysis completed');
      
      // Store in checkpoint
      checkpoint.riskAnalysis = riskAnalysis;
      
      // If critical risks, log warning
      if (riskAnalysis.escalationNeeded) {
        logger.warn({
          contractId,
          criticalRisks: riskAnalysis.risks.filter((r: any) => r.severity === 'CRITICAL').map((r: any) => r.type),
        }, '⚠️ ESCALATION REQUIRED: Critical risks detected in contract');
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Proactive risk detection failed');
    }
  } else if (checkpoint.riskAnalysis) {
    // Load from checkpoint
    riskAnalysis = checkpoint.riskAnalysis;
  }
  
  const done = allPlannedTerminal && artifactsOk;

  // 4. Intelligence Agent Passes — run registered agents post-artifact/post-pipeline
  if (done && !checkpoint.intelligenceRun) {
    try {
      const { runPostArtifactIntelligence, runPostPipelineIntelligence } = await import('./agents/agent-dispatch');
      
      // Get all generated artifacts for context
      const allArtifacts = await prisma.artifact.findMany({
        where: { contractId, tenantId },
        select: { type: true, data: true },
      });
      const artifactContext: Record<string, any> = {};
      for (const a of allArtifacts) {
        artifactContext[String(a.type)] = a.data;
      }

      // Build artifact array for agents that need it
      const artifactArray = allArtifacts.map(a => ({ type: String(a.type), data: a.data, id: String(a.type) }));

      const agentContext = {
        contractText: typeof contract?.rawText === 'string' ? contract.rawText : '',
        contractType: contractType || 'OTHER',
        artifacts: artifactContext,
        artifactArray,
        riskAnalysis,
        contract: {
          id: contractId,
          title: contract?.contractTitle || '',
          status: contract?.status,
          contractType: contractType || 'OTHER',
          totalValue: contract?.totalValue ?? 0,
          value: contract?.totalValue ?? contract?.annualValue ?? 0,
          annualValue: contract?.annualValue ?? 0,
          effectiveDate: contract?.effectiveDate,
          expirationDate: contract?.expirationDate,
          supplierName: contract?.supplierName || contract?.counterparty || contract?.vendor || '',
          parties: [contract?.supplierName, contract?.counterparty, contract?.vendor].filter(Boolean),
          autoRenewalEnabled: contract?.autoRenewalEnabled ?? false,
          department: contract?.department || '',
          renewalInitiated: !!contract?.renewalInitiatedAt,
        },
      };

      // Post-artifact: validation, health, gap-filling
      const postArtifactResults = await runPostArtifactIntelligence(contractId, tenantId, agentContext);
      
      // Post-pipeline: workflow, deadline, opportunity — enrich with post-artifact results
      const enrichedContext = {
        ...agentContext,
        postArtifactResults: Object.fromEntries(
          Array.from(postArtifactResults.entries()).map(([k, v]) => [k, { success: v.success, data: v.data, confidence: v.confidence }])
        ),
      };
      const postPipelineResults = await runPostPipelineIntelligence(contractId, tenantId, enrichedContext);

      const allResults: Record<string, any> = {};
      for (const [name, output] of postArtifactResults) allResults[name] = { success: output.success, confidence: output.confidence };
      for (const [name, output] of postPipelineResults) allResults[name] = { success: output.success, confidence: output.confidence };

      // Execute any recommended actions from agents (action execution loop)
      for (const [agentName, output] of [...postArtifactResults, ...postPipelineResults]) {
        if (output.success && output.data?.actions && Array.isArray(output.data.actions)) {
          for (const action of output.data.actions) {
            try {
              if (action.type === 'update_field' && action.field && action.value !== undefined) {
                await prisma.contract.update({
                  where: { id: contractId },
                  data: { [action.field]: action.value },
                });
                logger.info({ contractId, agentName, field: action.field }, 'Agent action: field updated');
              } else if (action.type === 'create_alert' && action.message) {
                logger.info({ contractId, agentName, alert: action.message }, 'Agent action: alert created');
              }
            } catch (actionErr) {
              logger.warn({ error: (actionErr as Error).message, agentName, action: action.type }, 'Agent action execution failed');
            }
          }
        }
      }

      logger.info({ contractId, agents: Object.keys(allResults), results: allResults }, '🧠 Intelligence agent passes completed');
      checkpoint.intelligenceRun = allResults;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error), contractId }, 'Intelligence agent passes failed (non-fatal)');
      checkpoint.intelligenceRun = { error: true };

      // Dispatch adaptive-retry agent on failure
      try {
        const { runOnFailure } = await import('./agents/agent-dispatch');
        const retryResult = await runOnFailure(contractId, tenantId, [
          { stage: 'intelligence-pass', error: error instanceof Error ? error.message : String(error), timestamp: new Date() },
        ]);
        if (retryResult.success) {
          logger.info({ contractId, strategy: retryResult.data }, 'Adaptive retry agent suggested recovery strategy');
        }
      } catch (retryErr) {
        logger.debug({ error: (retryErr as Error).message }, 'Retry agent dispatch failed (non-critical)');
      }
    }
  }

  // Persist agent decision snapshot into checkpointData (best-effort)
  try {
    const decision: AgentDecision = {
      decidedAt: nowIso(),
      proposals,
      enqueued,
      done,
    };

    const nextAgent = {
      version: 1,
      iteration,
      lastTickAt: nowIso(),
      done,
      lastDecision: decision,
      history: Array.isArray(checkpoint.agent?.history)
        ? [...checkpoint.agent.history, decision].slice(-50)
        : [decision],
    };

    await prisma.processingJob.update({
      where: { id: processingJob!.id },
      data: {
        checkpointData: {
          ...(checkpoint ?? {}),
          agent: nextAgent,
        } as any,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    logger.warn({ error, contractId, tenantId }, 'Failed to persist agent state');
  }

  let nextTickJobId: string | null = null;

  // Schedule another tick if not done.
  const maxIterations = Number.parseInt(process.env.AGENT_MAX_ITERATIONS || '20', 10);
  const tickDelayMs = Number.parseInt(process.env.AGENT_TICK_DELAY_MS || '5000', 10);

  if (!done && iteration < maxIterations) {
    const nextIteration = iteration + 1;
    const j = await queueService.addJob(
      QUEUE_NAMES.AGENT_ORCHESTRATION,
      JOB_NAMES.RUN_AGENT,
      {
        contractId,
        tenantId,
        traceId: trace.traceId,
        requestId: job.data.requestId,
        iteration: nextIteration,
      },
      {
        priority: 40,
        delay: tickDelayMs,
        jobId: `agent-${contractId}-${nextIteration}`,
      }
    );

    nextTickJobId = j?.id ?? null;

    try {
      const updated = await prisma.processingJob.findUnique({ where: { id: processingJob!.id }, select: { checkpointData: true } });
      const updatedCheckpoint = (updated?.checkpointData ?? {}) as any;
      if (updatedCheckpoint.agent?.lastDecision) {
        updatedCheckpoint.agent.lastDecision.nextTickEnqueued = { jobId: nextTickJobId, delayMs: tickDelayMs };
        await prisma.processingJob.update({
          where: { id: processingJob!.id },
          data: { checkpointData: updatedCheckpoint as any, updatedAt: new Date() },
        });
      }
    } catch {
      // ignore
    }
  }

  await updateStep({
    tenantId,
    contractId,
    step: 'agent.orchestrator',
    status: 'completed',
    progress: done ? 100 : 20,
    currentStep: 'agent.orchestrator',
  });

  logger.info({ contractId, tenantId, iteration, done, enqueuedCount: enqueued.length, nextTickJobId }, 'Agent tick completed');

  return { done, iteration };
}

export function registerAgentOrchestratorWorker() {
  const queueService = getQueueService();

  const concurrency = getWorkerConcurrency('AGENT_ORCHESTRATOR_CONCURRENCY', 2);
  const limiter = getWorkerLimiter(
    'AGENT_ORCHESTRATOR_LIMIT_MAX',
    'AGENT_ORCHESTRATOR_LIMIT_DURATION_MS',
    { max: 60, duration: 60000 }
  );

  const worker = queueService.registerWorker<AgentOrchestrationJobData, { done: boolean; iteration: number }>(
    QUEUE_NAMES.AGENT_ORCHESTRATION,
    runAgentOrchestrationJob,
    {
      concurrency,
      limiter,
    }
  );

  logger.info({ concurrency, limiter }, 'Agent orchestrator worker registered');

  return worker;
}
