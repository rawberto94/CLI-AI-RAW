# ConTigo Agentic Ecosystem - Specific Enhancements

> Based on analysis of existing code (Feb 2026)

---

## Part 1: Knowledge Graph Enhancements

### Current State Analysis

You have TWO knowledge graph implementations:

| Service | Location | Features |
|---------|----------|----------|
| **KnowledgeGraphService** | `packages/data-orchestration/src/services/knowledge-graph.service.ts` | Entity extraction via Claude, basic relationship inference, similar clause finding via embeddings |
| **ContractKnowledgeGraphService** | `packages/data-orchestration/src/services/contract-knowledge-graph.service.ts` | In-memory graph, path finding, subgraphs, entity similarity, graph stats |

**Gap:** These are not integrated and don't persist to a real graph database!

### Enhancement 1.1: Neo4j Integration Layer

Add a proper graph database backend to replace in-memory storage:

```typescript
// NEW: packages/data-orchestration/src/services/graph-db.service.ts

import neo4j, { Driver, Session } from 'neo4j-driver';

export class GraphDatabaseService {
  private driver: Driver;
  
  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
      )
    );
  }

  /**
   * Store entity with vector embedding for semantic search
   */
  async storeEntity(entity: GraphEntity, embedding?: number[]): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `
        MERGE (e:Entity {normalizedName: $normalizedName, type: $type})
        ON CREATE SET 
          e.id = $id,
          e.name = $name,
          e.createdAt = datetime($createdAt),
          e.confidence = $confidence,
          e.attributes = $attributes
        ON MATCH SET 
          e.aliases = apoc.coll.toSet(e.aliases + $aliases),
          e.sourceContracts = apoc.coll.toSet(e.sourceContracts + $sourceContracts),
          e.updatedAt = datetime()
        WITH e
        ${embedding ? 'CALL db.create.setNodeVectorProperty(e, "embedding", $embedding)' : ''}
        RETURN e
        `,
        {
          id: entity.id,
          name: entity.name,
          normalizedName: entity.normalizedName,
          type: entity.type,
          aliases: entity.aliases,
          sourceContracts: entity.sourceContracts,
          confidence: entity.confidence,
          attributes: JSON.stringify(entity.attributes),
          createdAt: entity.createdAt.toISOString(),
          embedding: embedding || null,
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Create relationship with confidence scoring
   */
  async createRelation(relation: GraphRelation): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (source:Entity {id: $sourceId})
        MATCH (target:Entity {id: $targetId})
        MERGE (source)-[r:RELATES {type: $type}]->(target)
        ON CREATE SET 
          r.id = $id,
          r.strength = $strength,
          r.attributes = $attributes,
          r.createdAt = datetime($createdAt),
          r.evidence = $evidence
        ON MATCH SET
          r.strength = CASE 
            WHEN r.strength < $strength THEN $strength 
            ELSE r.strength 
          END,
          r.evidence = apoc.coll.union(r.evidence, $evidence)
        `,
        {
          id: relation.id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          type: relation.type,
          strength: relation.strength,
          attributes: JSON.stringify(relation.attributes),
          createdAt: relation.createdAt.toISOString(),
          evidence: JSON.stringify(relation.evidence),
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Semantic similarity search using vector index
   */
  async findSimilarEntities(
    query: string,
    embedding: number[],
    tenantId: string,
    k: number = 10
  ): Promise<Array<{ entity: GraphEntity; similarity: number }>> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CALL db.index.vector.queryNodes('entity-embeddings', $k, $embedding)
        YIELD node, score
        WHERE node.tenantId = $tenantId
        RETURN node {
          .*,
          embedding: null
        } as entity, score as similarity
        `,
        { embedding, k, tenantId }
      );
      
      return result.records.map(r => ({
        entity: r.get('entity') as GraphEntity,
        similarity: r.get('similarity') as number,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Complex graph pattern queries for contract analysis
   */
  async findContractClusters(tenantId: string): Promise<ContractCluster[]> {
    const session = this.driver.session();
    try {
      // Find communities using Louvain algorithm
      const result = await session.run(
        `
        CALL gds.louvain.stream('contract-graph', { 
          nodeLabels: ['Entity'],
          relationshipTypes: ['RELATES'],
          consecutiveIds: true 
        })
        YIELD nodeId, communityId
        MATCH (e:Entity) WHERE id(e) = nodeId AND e.tenantId = $tenantId
        RETURN communityId, 
               collect(e {.*, embedding: null}) as entities,
               count(e) as size
        ORDER BY size DESC
        `,
        { tenantId }
      );
      
      return result.records.map(r => ({
        id: String(r.get('communityId')),
        entities: r.get('entities') as GraphEntity[],
        size: r.get('size') as number,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Find influential entities (PageRank)
   */
  async getInfluentialEntities(
    tenantId: string,
    limit: number = 20
  ): Promise<Array<{ entity: GraphEntity; score: number }>> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CALL gds.pageRank.stream('contract-graph', {
          nodeLabels: ['Entity'],
          relationshipTypes: ['RELATES'],
          relationshipWeightProperty: 'strength'
        })
        YIELD nodeId, score
        MATCH (e:Entity) WHERE id(e) = nodeId AND e.tenantId = $tenantId
        RETURN e {.*, embedding: null} as entity, score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { tenantId, limit }
      );
      
      return result.records.map(r => ({
        entity: r.get('entity') as GraphEntity,
        score: r.get('score') as number,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Path analysis: Find all paths between two entities
   */
  async findAllPaths(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<PathResult[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH path = (source:Entity {id: $sourceId})-[:RELATES*1..${maxDepth}]-(target:Entity {id: $targetId})
        WITH path, 
             [node in nodes(path) | node {.*, embedding: null}] as entityPath,
             [rel in relationships(path) | rel {.*}] as relations,
             reduce(total = 0.0, r in relationships(path) | total + r.strength) / length(path) as avgStrength
        RETURN entityPath as path, relations, avgStrength as totalStrength, length(path) as length
        ORDER BY avgStrength DESC, length(path) ASC
        LIMIT 10
        `,
        { sourceId, targetId }
      );
      
      return result.records.map(r => ({
        path: r.get('path') as GraphEntity[],
        relations: r.get('relations') as GraphRelation[],
        totalStrength: r.get('totalStrength') as number,
        length: r.get('length') as number,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Temporal analysis: Track entity evolution over time
   */
  async getEntityTimeline(entityId: string): Promise<EntityTimelineEvent[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity {id: $entityId})-[r:RELATES]-(other)
        RETURN e.name as entityName,
               r.type as relationshipType,
               other.name as relatedEntity,
               r.createdAt as timestamp,
               r.evidence as evidence
        ORDER BY r.createdAt ASC
        `,
        { entityId }
      );
      
      return result.records.map(r => ({
        entityName: r.get('entityName') as string,
        relationshipType: r.get('relationshipType') as string,
        relatedEntity: r.get('relatedEntity') as string,
        timestamp: new Date(r.get('timestamp') as string),
        evidence: JSON.parse(r.get('evidence') as string || '[]'),
      }));
    } finally {
      await session.close();
    }
  }
}
```

### Enhancement 1.2: Real-Time Graph Updates via Change Data Capture

```typescript
// NEW: packages/data-orchestration/src/services/graph-cdc.service.ts

import { prisma } from '../lib/prisma';
import { EventEmitter } from 'events';

/**
 * Change Data Capture for Knowledge Graph
 * Automatically updates graph when contracts change
 */
export class GraphCDCService extends EventEmitter {
  private graphDb: GraphDatabaseService;
  
  constructor(graphDb: GraphDatabaseService) {
    super();
    this.graphDb = graphDb;
  }

  /**
   * Process contract creation/update
   */
  async processContractChange(contractId: string, tenantId: string): Promise<void> {
    // Fetch contract with all related data
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: true,
        clauses: true,
        obligations: true,
        parties: true,
      },
    });

    if (!contract) return;

    // Extract and store entities
    const entities = await this.extractEntitiesFromContract(contract);
    
    for (const entity of entities) {
      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(entity.name);
      await this.graphDb.storeEntity(entity, embedding);
    }

    // Create relationships
    const relations = this.inferRelationships(contract, entities);
    for (const relation of relations) {
      await this.graphDb.createRelation(relation);
    }

    this.emit('graph:updated', { contractId, tenantId, entityCount: entities.length });
  }

  /**
   * Process obligation completion - update graph weights
   */
  async processObligationCompleted(
    obligationId: string,
    contractId: string
  ): Promise<void> {
    // Strengthen relationship between parties when obligations are fulfilled
    const session = this.graphDb['driver'].session();
    try {
      await session.run(
        `
        MATCH (o:Entity {type: 'obligation', contractId: $contractId})<-[:OBLIGATES]-(party:Entity)
        MATCH (party)-[r:RELATES]-(other:Entity)
        WHERE r.type = 'party_to'
        SET r.strength = r.strength * 1.1  // Increase trust score
        SET r.lastInteraction = datetime()
        `,
        { contractId }
      );
    } finally {
      await session.close();
    }
  }

  private async extractEntitiesFromContract(contract: any): Promise<GraphEntity[]> {
    // Use existing extraction logic + new ones
    const entities: GraphEntity[] = [];
    
    // Extract parties
    for (const party of contract.parties || []) {
      entities.push({
        id: `party-${party.id}`,
        type: 'party',
        name: party.name,
        normalizedName: party.name.toLowerCase().trim(),
        aliases: party.aliases || [],
        attributes: { role: party.role, email: party.email },
        sourceContracts: [contract.id],
        confidence: 0.95,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Extract obligations
    for (const obligation of contract.obligations || []) {
      entities.push({
        id: `obligation-${obligation.id}`,
        type: 'obligation',
        name: obligation.description.substring(0, 100),
        normalizedName: obligation.description.toLowerCase().trim(),
        aliases: [],
        attributes: { 
          dueDate: obligation.dueDate,
          status: obligation.status,
          priority: obligation.priority,
        },
        sourceContracts: [contract.id],
        confidence: 0.85,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return entities;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use OpenAI embeddings
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
}
```

### Enhancement 1.3: Graph-Powered Insights API

```typescript
// NEW: apps/web/app/api/intelligence/graph-insights/route.ts

import { NextRequest } from 'next/server';
import { withAuthApiHandler } from '@/lib/api-middleware';
import { graphDbService } from '@repo/data-orchestration/services/graph-db.service';

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const searchParams = req.nextUrl.searchParams;
  const insightType = searchParams.get('type');

  switch (insightType) {
    case 'hidden-connections':
      // Find non-obvious connections between contracts
      const connections = await findHiddenConnections(tenantId);
      return Response.json({ data: connections });

    case 'risk-clusters':
      // Find clusters of high-risk contracts
      const clusters = await findRiskClusters(tenantId);
      return Response.json({ data: clusters });

    case 'opportunity-paths':
      // Find cross-sell/up-sell opportunities
      const opportunities = await findOpportunityPaths(tenantId);
      return Response.json({ data: opportunities });

    case 'bottleneck-entities':
      // Find entities that connect many contracts (bottlenecks)
      const bottlenecks = await graphDbService.getInfluentialEntities(tenantId, 20);
      return Response.json({ data: bottlenecks });

    default:
      return Response.json({ error: 'Unknown insight type' }, { status: 400 });
  }
});

async function findHiddenConnections(tenantId: string) {
  // Find entities that appear in contracts but aren't explicitly linked
  const session = graphDbService['driver'].session();
  try {
    const result = await session.run(
      `
      // Find pairs of entities that appear together in contracts but have no direct relation
      MATCH (e1:Entity)-[:APPEARS_IN]->(c:Contract {tenantId: $tenantId})<-[:APPEARS_IN]-(e2:Entity)
      WHERE e1.id < e2.id
        AND e1.type = 'party'
        AND e2.type = 'party'
        AND NOT (e1)-[:RELATES]-(e2)
      WITH e1, e2, count(c) as sharedContractCount
      WHERE sharedContractCount >= 2
      RETURN e1.name as party1, e2.name as party2, sharedContractCount
      ORDER BY sharedContractCount DESC
      LIMIT 20
      `,
      { tenantId }
    );
    
    return result.records.map(r => ({
      party1: r.get('party1'),
      party2: r.get('party2'),
      sharedContractCount: r.get('sharedContractCount'),
      insight: `These parties work together frequently but may not have formal relationships mapped`,
    }));
  } finally {
    await session.close();
  }
}

async function findRiskClusters(tenantId: string) {
  // Use graph algorithms to find clusters of related high-risk contracts
  const session = graphDbService['driver'].session();
  try {
    const result = await session.run(
      `
      MATCH (risk:Entity {type: 'risk_indicator'})-[:APPEARS_IN]->(c:Contract {tenantId: $tenantId})
      WITH c, count(risk) as riskCount
      WHERE riskCount > 2
      MATCH (c)<-[:APPEARS_IN]-(e:Entity)
      WITH c, riskCount, collect(e) as entities
      RETURN c.id as contractId, c.title as title, riskCount, 
             [e in entities | e.name] as relatedEntities
      ORDER BY riskCount DESC
      LIMIT 20
      `,
      { tenantId }
    );
    
    return result.records.map(r => ({
      contractId: r.get('contractId'),
      title: r.get('title'),
      riskCount: r.get('riskCount'),
      relatedEntities: r.get('relatedEntities'),
    }));
  } finally {
    await session.close();
  }
}
```

---

## Part 2: Agentic Infrastructure Enhancements

### Current State Analysis

| Component | Location | Status |
|-----------|----------|--------|
| Autonomous Orchestrator | `packages/agents/autonomous-orchestrator.ts` | Event-driven goals, DB persistence |
| ReAct Agent | `packages/agents/react-agent.ts` | Multi-step reasoning, tool use |
| Streaming Chat API | `apps/web/app/api/ai/chat/stream/route.ts` | 18 tools, multi-model, RAG |
| Chat UI | `apps/web/app/ai/chat/page.tsx` | Full-featured with history |
| Floating Bubble | `apps/web/components/ai/FloatingAIBubble.tsx` | 136KB - very feature-rich |

### Enhancement 2.1: Agent Swarm Architecture

Create a multi-agent system where specialized agents collaborate:

```typescript
// NEW: packages/agents/src/swarm/agent-swarm.ts

import { EventEmitter } from 'events';

interface SwarmTask {
  id: string;
  description: string;
  requiredCapabilities: string[];
  context: Record<string, unknown>;
  deadline?: Date;
}

interface SwarmAgent {
  id: string;
  name: string;
  capabilities: string[];
  specialty: string;
  currentLoad: number;
  maxConcurrent: number;
}

/**
 * Agent Swarm - Dynamic team formation for complex tasks
 */
export class AgentSwarm extends EventEmitter {
  private agents: Map<string, SwarmAgent> = new Map();
  private taskQueue: SwarmTask[] = [];
  private activeTeams: Map<string, SwarmTeam> = new Map();

  /**
   * Register an agent with the swarm
   */
  registerAgent(agent: SwarmAgent): void {
    this.agents.set(agent.id, agent);
    this.emit('agent:registered', agent);
  }

  /**
   * Submit a task to the swarm - agents self-organize
   */
  async submitTask(task: SwarmTask): Promise<SwarmResult> {
    // Find agents with required capabilities
    const eligibleAgents = Array.from(this.agents.values()).filter(agent =>
      task.requiredCapabilities.every(cap => agent.capabilities.includes(cap))
    );

    if (eligibleAgents.length === 0) {
      throw new Error(`No agents available with capabilities: ${task.requiredCapabilities.join(', ')}`);
    }

    // Form optimal team based on load balancing
    const team = this.formTeam(eligibleAgents, task);
    this.activeTeams.set(task.id, team);

    this.emit('team:formed', { taskId: task.id, team });

    // Execute with team
    const result = await team.execute(task);
    
    this.activeTeams.delete(task.id);
    this.emit('task:completed', { taskId: task.id, result });

    return result;
  }

  private formTeam(agents: SwarmAgent[], task: SwarmTask): SwarmTeam {
    // Select lead agent (lowest load + most relevant specialty)
    const lead = agents
      .filter(a => a.currentLoad < a.maxConcurrent)
      .sort((a, b) => a.currentLoad - b.currentLoad)[0];

    // Select specialists based on task needs
    const specialists = agents
      .filter(a => a.id !== lead.id)
      .filter(a => a.currentLoad < a.maxConcurrent)
      .slice(0, 3); // Max 3 specialists

    return new SwarmTeam(lead, specialists, this);
  }
}

/**
 * A team of agents working together on a task
 */
class SwarmTeam {
  constructor(
    private lead: SwarmAgent,
    private specialists: SwarmAgent[],
    private swarm: AgentSwarm
  ) {}

  async execute(task: SwarmTask): Promise<SwarmResult> {
    // Lead creates plan
    const plan = await this.createPlan(task);
    
    // Delegate subtasks to specialists
    const subtaskResults = await Promise.all(
      plan.subtasks.map(async (subtask, idx) => {
        const agent = this.specialists[idx % this.specialists.length];
        return this.executeSubtask(agent, subtask, task.context);
      })
    );

    // Lead synthesizes results
    const synthesis = await this.synthesizeResults(task, plan, subtaskResults);

    return {
      taskId: task.id,
      plan,
      subtaskResults,
      synthesis,
      team: {
        lead: this.lead.id,
        specialists: this.specialists.map(a => a.id),
      },
    };
  }

  private async createPlan(task: SwarmTask): Promise<TaskPlan> {
    // Use LLM to create execution plan
    const prompt = `Create a plan for: ${task.description}
    
Available specialists:
${this.specialists.map(s => `- ${s.name}: ${s.specialty}`).join('\n')}

Break down into 2-4 subtasks that can be executed in parallel.`;

    // Call LLM to generate plan...
    return { subtasks: [] };
  }

  private async executeSubtask(
    agent: SwarmAgent,
    subtask: Subtask,
    context: Record<string, unknown>
  ): Promise<SubtaskResult> {
    // Route to specific agent implementation
    this.swarm.emit('subtask:started', { agent: agent.id, subtask });
    
    // Execute...
    const result = await this.callAgent(agent, subtask, context);
    
    this.swarm.emit('subtask:completed', { agent: agent.id, subtask, result });
    return result;
  }

  private async synthesizeResults(
    task: SwarmTask,
    plan: TaskPlan,
    results: SubtaskResult[]
  ): Promise<string> {
    // Use lead agent to combine results
    return `Synthesized result for ${task.description}`;
  }
}
```

### Enhancement 2.2: Proactive Agent System

Add agents that monitor and act without user prompts:

```typescript
// NEW: packages/agents/src/proactive/proactive-agent-system.ts

import { EventEmitter } from 'events';

interface ProactiveTrigger {
  id: string;
  type: 'schedule' | 'threshold' | 'anomaly' | 'opportunity';
  condition: TriggerCondition;
  action: ProactiveAction;
  cooldownMs: number;
  lastTriggered?: Date;
}

/**
 * Proactive Agent System - Monitors and acts autonomously
 */
export class ProactiveAgentSystem extends EventEmitter {
  private triggers: Map<string, ProactiveTrigger> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  startMonitoring(intervalMs: number = 60000): void {
    this.monitoringInterval = setInterval(() => this.checkTriggers(), intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  registerTrigger(trigger: ProactiveTrigger): void {
    this.triggers.set(trigger.id, trigger);
  }

  private async checkTriggers(): Promise<void> {
    for (const trigger of this.triggers.values()) {
      // Check cooldown
      if (trigger.lastTriggered) {
        const elapsed = Date.now() - trigger.lastTriggered.getTime();
        if (elapsed < trigger.cooldownMs) continue;
      }

      // Evaluate condition
      const shouldTrigger = await this.evaluateCondition(trigger.condition);
      
      if (shouldTrigger) {
        trigger.lastTriggered = new Date();
        await this.executeAction(trigger.action);
        this.emit('trigger:activated', trigger);
      }
    }
  }

  private async evaluateCondition(condition: TriggerCondition): Promise<boolean> {
    switch (condition.type) {
      case 'contract_expiry':
        return this.checkContractExpiry(condition.daysThreshold);
      
      case 'spend_threshold':
        return this.checkSpendThreshold(condition.threshold);
      
      case 'anomaly':
        return this.checkAnomaly(condition.metric);
      
      case 'opportunity':
        return this.checkOpportunity(condition.opportunityType);
      
      default:
        return false;
    }
  }

  private async checkContractExpiry(daysThreshold: number): Promise<boolean> {
    const prisma = await getPrisma();
    const expiringContracts = await prisma.contract.count({
      where: {
        endDate: {
          lte: new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
        status: 'ACTIVE',
      },
    });
    return expiringContracts > 0;
  }

  private async executeAction(action: ProactiveAction): Promise<void> {
    switch (action.type) {
      case 'notify':
        await this.sendNotification(action);
        break;
      
      case 'start_workflow':
        await this.startWorkflow(action);
        break;
      
      case 'generate_report':
        await this.generateReport(action);
        break;
      
      case 'suggest_action':
        await this.suggestAction(action);
        break;
    }
  }

  private async suggestAction(action: ProactiveAction): Promise<void> {
    // Create AI-generated suggestion in UI
    const suggestion = {
      id: uuid(),
      type: action.suggestionType,
      title: action.title,
      description: action.description,
      confidence: action.confidence,
      actions: action.actions,
      createdAt: new Date(),
    };

    // Store for UI to pick up
    await this.storeSuggestion(suggestion);
    
    this.emit('suggestion:created', suggestion);
  }
}

// Example proactive triggers to register:
const CONTRACT_RENEWAL_TRIGGER: ProactiveTrigger = {
  id: 'contract-renewal-90d',
  type: 'schedule',
  condition: { type: 'contract_expiry', daysThreshold: 90 },
  action: {
    type: 'suggest_action',
    suggestionType: 'renewal_prep',
    title: 'Contract Renewal Preparation',
    description: 'You have contracts expiring in 90 days that need renewal review',
    confidence: 0.9,
    actions: [
      { label: 'View Contracts', action: 'navigate:/renewals' },
      { label: 'Start Renewal Workflow', action: 'workflow:start:renewal' },
    ],
  },
  cooldownMs: 24 * 60 * 60 * 1000, // Once per day
};

const SPEND_ANOMALY_TRIGGER: ProactiveTrigger = {
  id: 'spend-anomaly',
  type: 'anomaly',
  condition: { type: 'anomaly', metric: 'monthly_spend' },
  action: {
    type: 'notify',
    channel: 'email',
    template: 'spend-anomaly-alert',
    priority: 'high',
  },
  cooldownMs: 4 * 60 * 60 * 1000, // Every 4 hours
};
```

### Enhancement 2.3: Enhanced Chat with Tool Visualization

Improve the chat UI to show tool execution in real-time:

```typescript
// NEW: apps/web/components/ai/chat/ToolExecutionVisualizer.tsx

interface ToolExecution {
  id: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: unknown;
  error?: string;
}

export function ToolExecutionVisualizer({ 
  executions 
}: { 
  executions: ToolExecution[] 
}) {
  return (
    <div className="space-y-2 my-4">
      {executions.map(exec => (
        <motion.div
          key={exec.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border",
            exec.status === 'running' && "bg-blue-50 border-blue-200",
            exec.status === 'completed' && "bg-green-50 border-green-200",
            exec.status === 'failed' && "bg-red-50 border-red-200"
          )}
        >
          {exec.status === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {exec.status === 'completed' && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          {exec.status === 'failed' && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          
          <div className="flex-1">
            <p className="text-sm font-medium">{formatToolName(exec.toolName)}</p>
            {exec.status === 'running' && (
              <Progress value={undefined} className="h-1 mt-1" />
            )}
            {exec.endTime && (
              <p className="text-xs text-muted-foreground">
                {formatDuration(exec.endTime.getTime() - exec.startTime.getTime())}
              </p>
            )}
          </div>
          
          {exec.result && (
            <ToolResultPreview result={exec.result} />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Enhanced chat message component with reasoning display
export function AgentMessage({ message }: { message: Message }) {
  return (
    <div className="space-y-3">
      {/* Show reasoning/plan if available */}
      {message.planSteps && message.planSteps.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Brain className="h-3 w-3" />
            Reasoning Process
          </p>
          <div className="space-y-1">
            {message.planSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                  {step.step}
                </span>
                <span className="text-muted-foreground">{step.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show tool executions */}
      {message.toolExecutions && message.toolExecutions.length > 0 && (
        <ToolExecutionVisualizer executions={message.toolExecutions} />
      )}

      {/* Show self-critique */}
      {message.selfCritique && (
        <div className={cn(
          "flex items-center gap-2 text-xs rounded px-2 py-1",
          message.selfCritique.grounded 
            ? "bg-green-50 text-green-700" 
            : "bg-yellow-50 text-yellow-700"
        )}>
          {message.selfCritique.grounded ? (
            <Shield className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          <span>Confidence: {Math.round(message.selfCritique.score * 100)}%</span>
          <span className="text-muted-foreground">{message.selfCritique.note}</span>
        </div>
      )}

      {/* Main content */}
      <div className="prose prose-sm dark:prose-invert">
        <MarkdownContent content={message.content} />
      </div>

      {/* Suggested actions */}
      {message.suggestions && message.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {message.suggestions.map((suggestion, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => handleSuggestionClick(suggestion)}
              className="text-xs"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Enhancement 2.4: Context-Aware Floating Bubble

Enhance the FloatingAIBubble with page context awareness:

```typescript
// ENHANCEMENT: Add to FloatingAIBubble.tsx

interface PageContext {
  route: string;
  entityType?: 'contract' | 'dashboard' | 'analytics' | 'workflow';
  entityId?: string;
  relevantData?: Record<string, unknown>;
}

/**
 * Context-aware suggestions based on current page
 */
function getContextualSuggestions(context: PageContext): QuickAction[] {
  switch (context.entityType) {
    case 'contract':
      return [
        { icon: FileSearch, label: 'Analyze this contract', query: '@analyze Analyze this contract for risks' },
        { icon: GitCompare, label: 'Compare to similar', query: '@search Find similar contracts' },
        { icon: Calculator, label: 'Calculate value', query: 'What is the total value of this contract?' },
        { icon: AlertCircle, label: 'Check obligations', query: '@obligations What are the key obligations?' },
      ];
    
    case 'dashboard':
      return [
        { icon: TrendingUp, label: 'Portfolio insights', query: '@intelligence What should I focus on today?' },
        { icon: DollarSign, label: 'Savings opportunities', query: '@savings Find cost savings opportunities' },
        { icon: Calendar, label: 'Upcoming deadlines', query: 'What deadlines are approaching?' },
        { icon: Shield, label: 'Risk summary', query: '@health What is my portfolio risk score?' },
      ];
    
    case 'workflow':
      return [
        { icon: Play, label: 'Check status', query: 'What is the status of this workflow?' },
        { icon: Users, label: 'Pending approvals', query: '@workflow Who needs to approve this?' },
        { icon: Zap, label: 'Escalate', query: '@workflow Escalate this approval' },
      ];
    
    default:
      return DEFAULT_QUICK_ACTIONS;
  }
}

/**
 * Auto-summarize page content for AI context
 */
async function generatePageSummary(context: PageContext): Promise<string> {
  if (!context.entityId || !context.entityType) return '';

  // Fetch relevant data based on context
  const data = await fetchPageData(context);
  
  // Create condensed summary for AI
  return `
Current Context:
- Page: ${context.route}
- Type: ${context.entityType}
- ID: ${context.entityId}

Relevant Information:
${JSON.stringify(data, null, 2).substring(0, 1000)}
`;
}
```

### Enhancement 2.5: Agent Memory System

Add persistent memory for agents to learn from interactions:

```typescript
// NEW: packages/agents/src/memory/agent-memory.service.ts

interface Memory {
  id: string;
  agentId: string;
  tenantId: string;
  type: 'interaction' | 'fact' | 'preference' | 'correction';
  content: string;
  context: string;
  embedding?: number[];
  importance: number; // 0-1
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

export class AgentMemoryService {
  /**
   * Store a new memory
   */
  async storeMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'accessCount'>): Promise<Memory> {
    // Generate embedding for semantic retrieval
    const embedding = await this.generateEmbedding(memory.content);
    
    const stored = await prisma.agentMemory.create({
      data: {
        ...memory,
        embedding: embedding as any,
        accessCount: 0,
      },
    });

    return stored as Memory;
  }

  /**
   * Retrieve relevant memories for a query
   */
  async retrieveMemories(
    query: string,
    agentId: string,
    tenantId: string,
    options: {
      maxResults?: number;
      minImportance?: number;
      types?: Memory['type'][];
    } = {}
  ): Promise<Array<Memory & { relevance: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Use pgvector for similarity search
    const memories = await prisma.$queryRaw`
      SELECT *, 
        1 - (embedding <=> ${queryEmbedding}::vector) as relevance
      FROM "AgentMemory"
      WHERE "agentId" = ${agentId}
        AND "tenantId" = ${tenantId}
        AND importance >= ${options.minImportance || 0.5}
        ${options.types ? sql`AND type IN (${Prisma.join(options.types)})` : sql``}
      ORDER BY relevance DESC, importance DESC
      LIMIT ${options.maxResults || 5}
    `;

    // Update access stats
    for (const memory of memories as Memory[]) {
      await prisma.agentMemory.update({
        where: { id: memory.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });
    }

    return memories as Array<Memory & { relevance: number }>;
  }

  /**
   * Consolidate similar memories to prevent bloat
   */
  async consolidateMemories(agentId: string): Promise<void> {
    // Find similar memories
    const memories = await prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });

    const toMerge: Array<[Memory, Memory]> = [];
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const sim = this.calculateSimilarity(memories[i], memories[j]);
        if (sim > 0.9) {
          toMerge.push([memories[i] as Memory, memories[j] as Memory]);
        }
      }
    }

    // Merge pairs
    for (const [keep, remove] of toMerge) {
      await this.mergeMemories(keep, remove);
    }
  }

  private async mergeMemories(keep: Memory, remove: Memory): Promise<void> {
    // Combine content
    const combinedContent = `${keep.content}\n${remove.content}`;
    
    await prisma.agentMemory.update({
      where: { id: keep.id },
      data: {
        content: combinedContent,
        importance: Math.max(keep.importance, remove.importance),
        accessCount: keep.accessCount + remove.accessCount,
      },
    });

    await prisma.agentMemory.delete({
      where: { id: remove.id },
    });
  }
}
```

---

## Implementation Priority

### Phase 1: Immediate (This Week)
1. **Neo4j Graph Database Setup**
   - Add Neo4j to docker-compose
   - Create schema migrations
   - Integrate with existing knowledge graph services

2. **Chat Tool Visualization**
   - Add `ToolExecutionVisualizer` component
   - Update streaming API to send tool events
   - Show reasoning steps in UI

### Phase 2: Short-term (Next 2 Weeks)
1. **Agent Memory System**
   - Add `AgentMemory` table to Prisma schema
   - Implement memory service
   - Integrate with chat API

2. **Context-Aware Floating Bubble**
   - Add page context detection
   - Implement contextual quick actions
   - Auto-summarize page content

### Phase 3: Medium-term (Next Month)
1. **Proactive Agent System**
   - Build trigger framework
   - Implement monitoring system
   - Create suggestion UI

2. **Agent Swarm Architecture**
   - Implement swarm coordination
   - Create specialized agents
   - Build team formation logic

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `docker-compose.dev.yml` | Add Neo4j service |
| `packages/clients/db/schema.prisma` | Add AgentMemory table |
| `packages/data-orchestration/src/services/` | Add graph-db.service.ts, graph-cdc.service.ts |
| `apps/web/app/api/ai/chat/stream/route.ts` | Add tool event streaming |
| `apps/web/components/ai/FloatingAIBubble.tsx` | Add context awareness |
| `apps/web/components/ai/chat/` | Add ToolExecutionVisualizer |

