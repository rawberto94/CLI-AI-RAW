import dataOrchestrationModule from '@repo/data-orchestration';

const dataOrchestration = dataOrchestrationModule as typeof import('@repo/data-orchestration');

export const agentContextEnrichmentService = dataOrchestration.agentContextEnrichmentService;

export type { EnrichedAgentContext } from '@repo/data-orchestration';