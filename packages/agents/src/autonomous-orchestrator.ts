/**
 * Autonomous Agent Orchestrator
 * 
 * This is the brain that makes the system "truly agentic" - capable of:
 * 1. Proactive monitoring and action (without user prompts)
 * 2. Goal decomposition and multi-step planning
 * 3. Continuous learning from outcomes
 * 4. Background task execution with user notification
 * 5. Self-initiated workflows based on triggers
 * 
 * Architecture:
 * - Event-driven triggers (contract expiry, anomalies, opportunities)
 * - Goal-based planning with hierarchical task decomposition
 * - Memory-augmented decision making
 * - Multi-agent coordination for complex tasks
 * - Human-in-the-loop for high-stakes decisions
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { getLearningContext, formatLearningContextForPrompt, invalidateLearningContext } from './learning-context';

// Lazy-init OpenAI client (only created when actually needed)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Lazy-init Prisma client (dynamic import to avoid circular deps)
let _prisma: any = null;
async function getPrisma(): Promise<any> {
  if (!_prisma) {
    try {
      // @ts-ignore — clients-db is a workspace alias resolved at runtime
      const clientsDb = await import('clients-db');
      const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
      _prisma = typeof getClient === 'function' ? getClient() : getClient;
    } catch {
      // Fallback: try @prisma/client directly
      try {
        const { PrismaClient } = await import('@prisma/client');
        _prisma = new PrismaClient();
      } catch {
        throw new Error('No Prisma client available for autonomous orchestrator');
      }
    }
  }
  return _prisma;
}

// ============================================================================
// AB-TEST-AWARE MODEL SELECTION
// Queries ab_test_winners for the winning variant's model name so the
// orchestrator automatically adopts proven-better models.
// Caches the winner for 5 minutes to avoid per-call DB queries.
// ============================================================================

let _abWinnerCache: { model: string | null; fetchedAt: number } = { model: null, fetchedAt: 0 };
const AB_WINNER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getABTestWinnerModel(): Promise<string> {
  const fallback = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const now = Date.now();

  // Return cached value if still fresh
  if (_abWinnerCache.fetchedAt > 0 && now - _abWinnerCache.fetchedAt < AB_WINNER_CACHE_TTL) {
    return _abWinnerCache.model || fallback;
  }

  try {
    const prisma = await getPrisma();
    const winner = await prisma.aBTestWinner?.findFirst?.({
      where: { testName: 'contract-extraction' },
      orderBy: { determinedAt: 'desc' },
    });
    const model = winner?.winnerVariantName ?? null;
    _abWinnerCache = { model, fetchedAt: now };
    return model || fallback;
  } catch {
    // DB not available — keep using environment variable
    _abWinnerCache = { model: null, fetchedAt: now };
    return fallback;
  }
}

// ============================================================================
// DATABASE PERSISTENCE LAYER
// Wraps Prisma operations with graceful fallback to in-memory for resilience.
// Goals, triggers, and notifications are persisted to DB and cached in-memory.
// ============================================================================

async function persistGoalToDB(goal: AgentGoal): Promise<void> {
  try {
    const prisma = await getPrisma();
    await prisma.agentGoal.upsert({
      where: { id: goal.id },
      create: {
        id: goal.id,
        tenantId: goal.tenantId,
        type: goal.type,
        title: goal.description,
        description: goal.description,
        priority: goalPriorityToInt(goal.priority),
        status: goalStatusToEnum(goal.status),
        context: goal.metadata ?? {},
        plan: goal.plan ? JSON.parse(JSON.stringify(goal.plan)) : undefined,
        totalSteps: goal.plan?.steps.length ?? 0,
        requiresApproval: goal.plan?.riskAssessment?.requiresHumanApproval ?? false,
        result: goal.result ? JSON.parse(JSON.stringify(goal.result)) : undefined,
      },
      update: {
        status: goalStatusToEnum(goal.status),
        progress: goal.status === 'completed' ? 100 : goal.status === 'executing' ? 50 : 0,
        plan: goal.plan ? JSON.parse(JSON.stringify(goal.plan)) : undefined,
        totalSteps: goal.plan?.steps.length ?? 0,
        result: goal.result ? JSON.parse(JSON.stringify(goal.result)) : undefined,
        startedAt: goal.status === 'executing' ? new Date() : undefined,
        completedAt: goal.completedAt ?? undefined,
        error: goal.result && !goal.result.success ? goal.result.summary : undefined,
      },
    });
  } catch (error: any) {
    // Graceful fallback — in-memory still works
    if (error?.code !== 'P2021' && error?.code !== 'P2010') {
      console.warn('[Orchestrator] DB persist failed for goal:', goal.id, error?.message);
    }
  }
}

async function persistNotificationToDB(notification: AgentNotification): Promise<void> {
  try {
    const prisma = await getPrisma();
    await prisma.auditLog?.create?.({
      data: {
        tenantId: notification.tenantId,
        userId: notification.userId ?? 'system',
        action: `agent:${notification.type}`,
        resource: 'agent_notification',
        resourceId: notification.goalId ?? notification.id,
        details: {
          notificationId: notification.id,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          actionRequired: notification.actionRequired,
        },
      },
    });
  } catch {
    // Notifications are best-effort — in-memory still serves them
  }
}

async function loadGoalsFromDB(tenantId: string): Promise<AgentGoal[]> {
  try {
    const prisma = await getPrisma();
    const dbGoals = await prisma.agentGoal.findMany({
      where: { tenantId, status: { notIn: ['COMPLETED', 'FAILED', 'CANCELLED'] } },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return dbGoals.map((g: any) => dbGoalToInMemory(g));
  } catch {
    return [];
  }
}

async function loadTriggersFromDB(tenantId?: string): Promise<AgentTrigger[]> {
  try {
    const prisma = await getPrisma();
    const where: any = { isActive: true };
    if (tenantId) where.tenantId = tenantId;
    const dbTriggers = await prisma.agentTrigger.findMany({ where, take: 200 });
    return dbTriggers.map((t: any) => dbTriggerToInMemory(t));
  } catch {
    return [];
  }
}

function goalPriorityToInt(p: AgentGoalPriority): number {
  const map: Record<AgentGoalPriority, number> = { critical: 1, high: 2, medium: 5, low: 7, background: 10 };
  return map[p] ?? 5;
}

function goalStatusToEnum(s: AgentGoalStatus): string {
  const map: Record<AgentGoalStatus, string> = {
    pending: 'PENDING', planning: 'PLANNING', executing: 'EXECUTING',
    awaiting_approval: 'AWAITING_APPROVAL', completed: 'COMPLETED',
    failed: 'FAILED', cancelled: 'CANCELLED',
  };
  return map[s] ?? 'PENDING';
}

function dbGoalToInMemory(g: any): AgentGoal {
  const priorityMap: Record<number, AgentGoalPriority> = { 1: 'critical', 2: 'high', 5: 'medium', 7: 'low', 10: 'background' };
  const statusMap: Record<string, AgentGoalStatus> = {
    PENDING: 'pending', PLANNING: 'planning', EXECUTING: 'executing',
    AWAITING_APPROVAL: 'awaiting_approval', COMPLETED: 'completed',
    FAILED: 'failed', CANCELLED: 'cancelled', PAUSED: 'pending',
  };
  return {
    id: g.id,
    tenantId: g.tenantId,
    type: g.type,
    description: g.description ?? g.title,
    priority: priorityMap[g.priority] ?? 'medium',
    status: statusMap[g.status] ?? 'pending',
    trigger: { type: 'user_request', source: 'db_restore' },
    plan: g.plan ?? undefined,
    result: g.result ?? undefined,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    completedAt: g.completedAt ?? undefined,
    metadata: g.context ?? {},
  };
}

function dbTriggerToInMemory(t: any): AgentTrigger {
  return {
    id: t.id,
    tenantId: t.tenantId,
    name: t.name,
    type: t.type?.toLowerCase() as TriggerType ?? 'event',
    enabled: t.isActive,
    condition: { type: t.cronExpression ? 'cron' : 'event_match', config: t.eventFilter ?? { schedule: t.cronExpression } },
    goalTemplate: { type: t.name, description: t.name, priority: 'medium' },
    lastTriggered: t.lastTriggeredAt ?? undefined,
    triggerCount: t.triggerCount ?? 0,
    createdAt: t.createdAt,
  };
}

// ============================================================================
// TYPES
// ============================================================================

export type AgentGoalPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';
export type AgentGoalStatus = 'pending' | 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
export type TriggerType = 'schedule' | 'event' | 'threshold' | 'pattern' | 'user_request';

export interface AgentGoal {
  id: string;
  tenantId: string;
  type: string;
  description: string;
  priority: AgentGoalPriority;
  status: AgentGoalStatus;
  trigger: {
    type: TriggerType;
    source: string;
    data?: Record<string, unknown>;
  };
  plan?: ExecutionPlan;
  result?: GoalResult;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
  id: string;
  goalId: string;
  steps: PlanStep[];
  estimatedDuration: number; // seconds
  requiredApprovals: string[];
  riskAssessment: RiskAssessment;
  createdAt: Date;
}

export interface PlanStep {
  id: string;
  order: number;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  dependencies: string[]; // Step IDs that must complete first
  agentId?: string;
  toolCalls?: ToolCall[];
  result?: unknown;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ToolCall {
  toolId: string;
  input: Record<string, unknown>;
  output?: unknown;
  executedAt?: Date;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  mitigations: string[];
  requiresHumanApproval: boolean;
}

export interface RiskFactor {
  category: string;
  description: string;
  severity: number; // 0-1
  likelihood: number; // 0-1
}

export interface GoalResult {
  success: boolean;
  summary: string;
  outcomes: Outcome[];
  lessonsLearned?: string[];
  recommendations?: string[];
}

export interface Outcome {
  type: string;
  description: string;
  value?: unknown;
  impact?: 'positive' | 'neutral' | 'negative';
}

export interface AgentTrigger {
  id: string;
  tenantId: string;
  name: string;
  type: TriggerType;
  enabled: boolean;
  condition: TriggerCondition;
  goalTemplate: GoalTemplate;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

export interface TriggerCondition {
  type: 'cron' | 'event_match' | 'threshold' | 'pattern_detection';
  config: Record<string, unknown>;
}

export interface GoalTemplate {
  type: string;
  description: string;
  priority: AgentGoalPriority;
  planningHints?: string[];
}

export interface AgentNotification {
  id: string;
  tenantId: string;
  userId?: string;
  type: 'goal_started' | 'goal_completed' | 'approval_required' | 'error' | 'insight';
  title: string;
  message: string;
  goalId?: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  actionRequired: boolean;
  createdAt: Date;
}

// ============================================================================
// AUTONOMOUS AGENT ORCHESTRATOR
// ============================================================================

export class AutonomousAgentOrchestrator extends EventEmitter {
  private goals: Map<string, AgentGoal> = new Map();
  private triggers: Map<string, AgentTrigger> = new Map();
  private notifications: Map<string, AgentNotification[]> = new Map();
  private executionQueue: AgentGoal[] = [];
  private isRunning: boolean = false;
  private processingGoal: string | null = null;
  private hydrated: boolean = false;
  private cronInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Accumulated token usage per goal for observability */
  private goalTokenUsage: Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCost: number }> = new Map();
  
  // Configuration
  private maxConcurrentGoals: number = 3;
  private planningTimeout: number = 30000; // 30 seconds
  private stepTimeout: number = 60000; // 60 seconds

  // P0-FIX: Memory leak prevention — cap map sizes
  private static readonly MAX_GOALS = 500;
  private static readonly MAX_NOTIFICATIONS_PER_TENANT = 100;
  private static readonly STALE_GOAL_TTL_MS = 60 * 60 * 1000; // 1 hour
  
  constructor() {
    super();
    this.setupDefaultTriggers();
    // Auto-hydrate from DB on startup (non-blocking)
    this.hydrateFromDB().catch(() => {});
    // Start the cron scheduler for trigger evaluation
    this.startCronScheduler();
  }

  /**
   * P0-FIX: Evict stale completed/failed goals and trim notification lists
   * to prevent unbounded memory growth in long-running processes.
   */
  private evictStaleEntries(): void {
    const now = Date.now();
    const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);

    // Evict completed/failed/cancelled goals older than TTL
    for (const [goalId, goal] of this.goals) {
      if (terminalStatuses.has(goal.status)) {
        const age = now - goal.updatedAt.getTime();
        if (age > AutonomousAgentOrchestrator.STALE_GOAL_TTL_MS) {
          this.goals.delete(goalId);
          this.goalTokenUsage.delete(goalId);
        }
      }
    }

    // Hard cap: if still over MAX_GOALS, remove oldest terminal goals first
    if (this.goals.size > AutonomousAgentOrchestrator.MAX_GOALS) {
      const sortedTerminal = [...this.goals.entries()]
        .filter(([, g]) => terminalStatuses.has(g.status))
        .sort(([, a], [, b]) => a.updatedAt.getTime() - b.updatedAt.getTime());
      
      while (this.goals.size > AutonomousAgentOrchestrator.MAX_GOALS && sortedTerminal.length > 0) {
        const [id] = sortedTerminal.shift()!;
        this.goals.delete(id);
        this.goalTokenUsage.delete(id);
      }
    }

    // Trim notifications per tenant
    for (const [tenantId, notifications] of this.notifications) {
      if (notifications.length > AutonomousAgentOrchestrator.MAX_NOTIFICATIONS_PER_TENANT) {
        // Keep only the most recent notifications
        this.notifications.set(
          tenantId,
          notifications.slice(-AutonomousAgentOrchestrator.MAX_NOTIFICATIONS_PER_TENANT)
        );
      }
    }
  }

  /**
   * Restore active goals and triggers from the database after a restart.
   * This ensures no work is lost across PM2 restarts or deployments.
   */
  async hydrateFromDB(tenantId?: string): Promise<{ goals: number; triggers: number }> {
    if (this.hydrated) return { goals: 0, triggers: 0 };
    
    try {
      // Load active goals
      const dbGoals = await loadGoalsFromDB(tenantId ?? 'system');
      for (const goal of dbGoals) {
        if (!this.goals.has(goal.id)) {
          this.goals.set(goal.id, goal);
          if (goal.status === 'pending' || goal.status === 'planning') {
            this.executionQueue.push(goal);
          }
        }
      }
      this.sortExecutionQueue();

      // Load triggers from DB
      const dbTriggers = await loadTriggersFromDB(tenantId);
      for (const trigger of dbTriggers) {
        if (!this.triggers.has(trigger.id)) {
          this.triggers.set(trigger.id, trigger);
        }
      }

      this.hydrated = true;
      this.emit('orchestrator:hydrated', { goals: dbGoals.length, triggers: dbTriggers.length });
      return { goals: dbGoals.length, triggers: dbTriggers.length };
    } catch (error) {
      // DB not available — continue with in-memory only
      this.hydrated = true;
      return { goals: 0, triggers: 0 };
    }
  }

  // ============================================================================
  // CRON TRIGGER SCHEDULER
  // ============================================================================

  /**
   * Start the cron scheduler that evaluates triggers on a regular interval.
   * Checks every 60 seconds which cron-based triggers should fire.
   */
  startCronScheduler(): void {
    if (this.cronInterval) return; // Already running

    const CRON_CHECK_INTERVAL_MS = 60_000; // Check every minute

    this.cronInterval = setInterval(async () => {
      try {
        await this.evaluateCronTriggers();
      } catch (error) {
        console.error('[Orchestrator] Cron scheduler error:', error);
      }
    }, CRON_CHECK_INTERVAL_MS);

    // Don't block process exit
    if (this.cronInterval?.unref) this.cronInterval.unref();
    this.emit('cron:scheduler_started');
  }

  /**
   * Stop the cron scheduler.
   */
  stopCronScheduler(): void {
    if (this.cronInterval) {
      clearInterval(this.cronInterval);
      this.cronInterval = null;
      this.emit('cron:scheduler_stopped');
    }
  }

  /**
   * Evaluate all enabled cron triggers and fire any that are due.
   * Uses a simple cron expression matching approach.
   */
  private async evaluateCronTriggers(): Promise<void> {
    const now = new Date();

    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled) continue;
      if (trigger.condition.type !== 'cron') continue;

      const schedule = trigger.condition.config?.schedule as string;
      if (!schedule) continue;

      if (this.cronExpressionMatches(schedule, now)) {
        // Prevent double-fire: skip if triggered within the last 55 seconds
        if (trigger.lastTriggered) {
          const elapsed = now.getTime() - trigger.lastTriggered.getTime();
          if (elapsed < 55_000) continue;
        }

        trigger.lastTriggered = now;
        trigger.triggerCount += 1;

        this.emit('trigger:fired', { triggerId: trigger.id, name: trigger.name, at: now });

        try {
          await this.createGoal(
            trigger.tenantId,
            trigger.goalTemplate.type,
            trigger.goalTemplate.description,
            {
              priority: trigger.goalTemplate.priority,
              trigger: { type: 'schedule', source: trigger.name },
              metadata: { triggerId: trigger.id, cronSchedule: schedule },
            }
          );
        } catch (err) {
          console.error(`[Orchestrator] Failed to create goal for trigger ${trigger.name}:`, err);
        }
      }
    }
  }

  /**
   * Minimal cron expression matcher: "min hour dom month dow"
   * Supports * (any), specific numbers, and star-slash-n (every n).
   */
  private cronExpressionMatches(cron: string, date: Date): boolean {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const fields = [
      date.getMinutes(),   // 0
      date.getHours(),     // 1
      date.getDate(),      // 2 (1-31)
      date.getMonth() + 1, // 3 (1-12)
      date.getDay(),       // 4 (0=Sun, 6=Sat)
    ];

    for (let i = 0; i < 5; i++) {
      const part = parts[i]!;
      const value = fields[i]!;

      if (part === '*') continue;

      // */n — every n
      const stepMatch = part.match(/^\*\/(\d+)$/);
      if (stepMatch) {
        const step = parseInt(stepMatch[1]!, 10);
        if (step > 0 && value % step !== 0) return false;
        continue;
      }

      // Comma-separated values
      const allowed = part.split(',').map(v => parseInt(v, 10));
      if (!allowed.includes(value)) return false;
    }

    return true;
  }

  // ============================================================================
  // TRIGGER MANAGEMENT
  // ============================================================================

  /**
   * Register default triggers for common scenarios
   */
  private setupDefaultTriggers(): void {
    // These would typically be loaded from database
    const defaultTriggers: Omit<AgentTrigger, 'id' | 'createdAt'>[] = [
      {
        tenantId: 'system',
        name: 'Contract Expiry Alert',
        type: 'schedule',
        enabled: true,
        condition: {
          type: 'cron',
          config: { schedule: '0 9 * * *' } // Daily at 9 AM
        },
        goalTemplate: {
          type: 'contract_expiry_review',
          description: 'Review contracts expiring in the next 30 days and prepare renewal recommendations',
          priority: 'high',
          planningHints: [
            'Identify all contracts expiring within 30 days',
            'Analyze performance metrics for each contract',
            'Generate renewal vs non-renewal recommendations',
            'Prepare negotiation strategies for renewals'
          ]
        },
        triggerCount: 0
      },
      {
        tenantId: 'system',
        name: 'Anomaly Detection',
        type: 'event',
        enabled: true,
        condition: {
          type: 'pattern_detection',
          config: { 
            patterns: ['unusual_spending', 'contract_breach_risk', 'compliance_violation']
          }
        },
        goalTemplate: {
          type: 'anomaly_investigation',
          description: 'Investigate detected anomaly and recommend corrective actions',
          priority: 'critical',
          planningHints: [
            'Gather all relevant context about the anomaly',
            'Perform root cause analysis',
            'Assess immediate and long-term risks',
            'Propose mitigation strategies'
          ]
        },
        triggerCount: 0
      },
      {
        tenantId: 'system',
        name: 'Savings Opportunity Scanner',
        type: 'schedule',
        enabled: true,
        condition: {
          type: 'cron',
          config: { schedule: '0 6 * * 1' } // Every Monday at 6 AM
        },
        goalTemplate: {
          type: 'savings_opportunity_scan',
          description: 'Analyze contracts and spending patterns to identify cost savings opportunities',
          priority: 'medium',
          planningHints: [
            'Analyze current contract rates vs market benchmarks',
            'Identify consolidation opportunities',
            'Find underutilized contracts',
            'Generate savings recommendations with ROI estimates'
          ]
        },
        triggerCount: 0
      },
      {
        tenantId: 'system',
        name: 'Compliance Audit',
        type: 'schedule',
        enabled: true,
        condition: {
          type: 'cron',
          config: { schedule: '0 0 1 * *' } // First day of each month
        },
        goalTemplate: {
          type: 'compliance_audit',
          description: 'Perform automated compliance audit across all active contracts',
          priority: 'high',
          planningHints: [
            'Check all contracts against regulatory requirements',
            'Verify required clauses are present',
            'Identify expiring certifications',
            'Generate compliance report and remediation plan'
          ]
        },
        triggerCount: 0
      },
      {
        tenantId: 'system',
        name: 'Workflow Escalation Check',
        type: 'schedule',
        enabled: true,
        condition: {
          type: 'cron',
          config: { schedule: '0 */4 * * *' } // Every 4 hours
        },
        goalTemplate: {
          type: 'workflow_escalation',
          description: 'Check for overdue workflow steps and escalate as needed',
          priority: 'high',
          planningHints: [
            'Query all pending workflow steps',
            'Identify overdue approvals',
            'Send reminders to assignees',
            'Escalate to managers if critical'
          ]
        },
        triggerCount: 0
      },
      {
        tenantId: 'system',
        name: 'Auto-Start Workflows',
        type: 'event',
        enabled: true,
        condition: {
          type: 'event_match',
          config: { 
            events: ['contract_uploaded', 'contract_ready_for_review'],
            requiresApproval: true
          }
        },
        goalTemplate: {
          type: 'auto_start_workflow',
          description: 'Automatically start appropriate approval workflow for new contracts',
          priority: 'medium',
          planningHints: [
            'Analyze contract to determine required approvals',
            'Select or create appropriate workflow',
            'Start workflow execution',
            'Notify first approver'
          ]
        },
        triggerCount: 0
      }
    ];

    defaultTriggers.forEach(trigger => {
      const fullTrigger: AgentTrigger = {
        ...trigger,
        id: uuidv4(),
        createdAt: new Date()
      };
      this.triggers.set(fullTrigger.id, fullTrigger);
    });
  }

  /**
   * Register a custom trigger
   */
  registerTrigger(trigger: Omit<AgentTrigger, 'id' | 'createdAt' | 'triggerCount'>): AgentTrigger {
    const fullTrigger: AgentTrigger = {
      ...trigger,
      id: uuidv4(),
      createdAt: new Date(),
      triggerCount: 0
    };
    
    this.triggers.set(fullTrigger.id, fullTrigger);
    this.emit('trigger:registered', fullTrigger);
    
    return fullTrigger;
  }

  /**
   * Enable/disable a trigger
   */
  setTriggerEnabled(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    
    trigger.enabled = enabled;
    this.emit('trigger:updated', trigger);
    
    return true;
  }

  // ============================================================================
  // GOAL MANAGEMENT
  // ============================================================================

  /**
   * Create a new autonomous goal
   */
  async createGoal(
    tenantId: string,
    type: string,
    description: string,
    options: {
      priority?: AgentGoalPriority;
      trigger?: AgentGoal['trigger'];
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<AgentGoal> {
    const goal: AgentGoal = {
      id: uuidv4(),
      tenantId,
      type,
      description,
      priority: options.priority || 'medium',
      status: 'pending',
      trigger: options.trigger || {
        type: 'user_request',
        source: 'manual'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: options.metadata
    };
    
    // P0-FIX: Evict stale entries before adding new goals to prevent memory leaks
    this.evictStaleEntries();
    
    this.goals.set(goal.id, goal);
    this.executionQueue.push(goal);
    
    // Sort queue by priority
    this.sortExecutionQueue();
    
    // Write-ahead: persist to DB BEFORE processing to prevent goal loss on crash
    await persistGoalToDB(goal);
    
    this.emit('goal:created', goal);
    this.notifyUser(tenantId, {
      type: 'goal_started',
      title: 'New Autonomous Task',
      message: `Agent is starting work on: ${description}`,
      goalId: goal.id,
      priority: goal.priority === 'critical' ? 'high' : 'medium',
      actionRequired: false
    });
    
    // Start processing if not already running
    if (!this.isRunning) {
      this.startProcessing();
    }
    
    return goal;
  }

  /**
   * Cancel an in-progress goal
   */
  async cancelGoal(goalId: string, reason?: string): Promise<boolean> {
    const goal = this.goals.get(goalId);
    if (!goal) return false;
    
    if (goal.status === 'completed' || goal.status === 'failed') {
      return false; // Already finished
    }
    
    goal.status = 'cancelled';
    goal.updatedAt = new Date();
    goal.result = {
      success: false,
      summary: `Goal cancelled: ${reason || 'User requested cancellation'}`,
      outcomes: []
    };
    
    // Remove from queue
    this.executionQueue = this.executionQueue.filter(g => g.id !== goalId);
    
    // Persist cancellation to DB (write-ahead)
    await persistGoalToDB(goal);
    
    this.emit('goal:cancelled', goal);
    
    return true;
  }

  /**
   * Sort execution queue by priority
   */
  private sortExecutionQueue(): void {
    const priorityOrder: Record<AgentGoalPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      background: 4
    };
    
    this.executionQueue.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  // ============================================================================
  // PLANNING ENGINE
  // ============================================================================

  /**
   * Generate an execution plan for a goal
   */
  async planGoal(goal: AgentGoal): Promise<ExecutionPlan> {
    goal.status = 'planning';
    goal.updatedAt = new Date();
    this.emit('goal:planning', goal);
    
    // Use AI to decompose the goal into steps
    const steps = await this.decomposeGoal(goal);
    
    // Assess risks
    const riskAssessment = await this.assessRisks(goal, steps);
    
    // Determine required approvals
    const requiredApprovals = this.determineRequiredApprovals(goal, riskAssessment);
    
    const plan: ExecutionPlan = {
      id: uuidv4(),
      goalId: goal.id,
      steps,
      estimatedDuration: this.estimateDuration(steps),
      requiredApprovals,
      riskAssessment,
      createdAt: new Date()
    };
    
    goal.plan = plan;
    goal.updatedAt = new Date();
    
    this.emit('goal:planned', { goal, plan });
    
    return plan;
  }

  /**
   * Known actions the executeStep engine can handle.
   * Used by the LLM as a reference and as a fallback when LLM is unavailable.
   */
  private static readonly KNOWN_ACTIONS = [
    'query_contracts', 'analyze_performance', 'market_comparison',
    'generate_recommendations', 'prepare_strategies', 'create_report',
    'gather_context', 'analyze_root_cause', 'assess_impact',
    'propose_mitigations', 'create_alert', 'analyze_spending',
    'benchmark_rates', 'find_consolidation', 'detect_underutilization',
    'calculate_roi', 'prioritize_opportunities', 'load_requirements',
    'scan_contracts', 'check_clauses', 'check_certifications',
    'identify_gaps', 'create_remediation_plan', 'query_pending_workflows',
    'identify_overdue', 'categorize_urgency', 'send_reminders',
    'escalate_critical', 'generate_report', 'analyze_contract',
    'evaluate_value', 'select_workflow', 'configure_steps',
    'start_execution', 'notify_approvers', 'get_pending_approvals',
    'analyze_bottlenecks', 'calculate_metrics', 'identify_delays',
    'suggest_improvements', 'review_contract', 'check_compliance',
    'assess_risk', 'validate_approvals', 'make_decision', 'record_decision',
  ] as const;

  /**
   * Static fallback templates (used when LLM is unavailable)
   */
  private static readonly FALLBACK_TEMPLATES: Record<string, Omit<PlanStep, 'id' | 'order' | 'status' | 'dependencies'>[]> = {
    contract_expiry_review: [
      { action: 'query_contracts', description: 'Query contracts expiring in the next 30 days' },
      { action: 'analyze_performance', description: 'Analyze performance metrics for each contract' },
      { action: 'market_comparison', description: 'Compare current rates with market benchmarks' },
      { action: 'generate_recommendations', description: 'Generate renewal vs non-renewal recommendations' },
      { action: 'create_report', description: 'Create summary report for stakeholders' },
    ],
    anomaly_investigation: [
      { action: 'gather_context', description: 'Gather all relevant context about the anomaly' },
      { action: 'analyze_root_cause', description: 'Perform root cause analysis' },
      { action: 'assess_impact', description: 'Assess immediate and long-term impact' },
      { action: 'propose_mitigations', description: 'Propose mitigation strategies' },
      { action: 'create_alert', description: 'Create high-priority alert for stakeholders' },
    ],
    savings_opportunity_scan: [
      { action: 'analyze_spending', description: 'Analyze current spending patterns' },
      { action: 'benchmark_rates', description: 'Compare contract rates vs market benchmarks' },
      { action: 'find_consolidation', description: 'Identify contract consolidation opportunities' },
      { action: 'calculate_roi', description: 'Calculate ROI for each opportunity' },
      { action: 'prioritize_opportunities', description: 'Rank opportunities by potential impact' },
    ],
    compliance_audit: [
      { action: 'scan_contracts', description: 'Scan all active contracts for compliance' },
      { action: 'check_clauses', description: 'Verify required clauses are present' },
      { action: 'identify_gaps', description: 'Identify compliance gaps' },
      { action: 'create_remediation_plan', description: 'Create remediation plan for gaps' },
    ],
    workflow_escalation: [
      { action: 'query_pending_workflows', description: 'Query all pending workflow step executions' },
      { action: 'identify_overdue', description: 'Identify steps past their deadline' },
      { action: 'escalate_critical', description: 'Escalate critical overdue items to managers' },
      { action: 'generate_report', description: 'Generate workflow health report' },
    ],
  };

  /**
   * Decompose a goal into executable steps using LLM-based planning.
   * Falls back to static templates if the LLM is unavailable.
   */
  private async decomposeGoal(goal: AgentGoal): Promise<PlanStep[]> {
    // Try LLM-based decomposition first
    if (process.env.OPENAI_API_KEY) {
      try {
        const steps = await this.decomposeGoalWithLLM(goal);
        if (steps.length > 0) return steps;
      } catch (error) {
        // LLM failed — fall back to static templates
        this.emit('planning:llm_fallback', {
          goalId: goal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback: use static templates
    return this.decomposeGoalFromTemplates(goal);
  }

  /**
   * LLM-powered goal decomposition
   */
  private async decomposeGoalWithLLM(goal: AgentGoal): Promise<PlanStep[]> {
    const openai = getOpenAI();

    // Inject learning context — the system gets smarter over time
    const learningCtx = await getLearningContext(goal.tenantId);
    const learnedPatterns = formatLearningContextForPrompt(learningCtx);

    const systemPrompt = `You are a contract management AI planner. Given a goal, decompose it into concrete executable steps.

AVAILABLE ACTIONS (use ONLY these action names):
${AutonomousAgentOrchestrator.KNOWN_ACTIONS.join(', ')}

${learnedPatterns ? `\n${learnedPatterns}\n` : ''}
Return a JSON array of steps, each with:
- "action": one of the available action names above
- "description": a clear description of what this step does
- "dependencies": array of action names that must complete before this step (empty for first step)

Rules:
- Use 3-8 steps per goal
- Each step must use action names from the AVAILABLE ACTIONS list
- Steps should be sequential where order matters, but independent steps can run in parallel
- Return ONLY valid JSON array, no markdown, no explanation
- If historical patterns show failures for certain goal types, add extra validation steps`;

    const userPrompt = `Goal type: ${goal.type}
Goal description: ${goal.description}
Priority: ${goal.priority}
Tenant: ${goal.tenantId}
${goal.metadata ? `Context: ${JSON.stringify(goal.metadata)}` : ''}

Decompose this into executable steps.`;

    const selectedModel = await getABTestWinnerModel();
    const response = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    // Track token usage for observability
    this.trackTokenUsage('_planning', response.usage);

    const content = response.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }

    // Handle both { steps: [...] } and direct array
    const rawSteps: any[] = Array.isArray(parsed) ? parsed : (parsed.steps || []);
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) return [];

    // Validate and sanitize actions
    const knownSet = new Set<string>(AutonomousAgentOrchestrator.KNOWN_ACTIONS);
    return rawSteps
      .filter((s: any) => s.action && s.description)
      .slice(0, 10) // cap at 10 steps
      .map((s: any, index: number) => ({
        id: uuidv4(),
        order: index + 1,
        action: knownSet.has(s.action) ? s.action : 'analyze', // fallback unknown actions
        description: String(s.description).slice(0, 500),
        status: 'pending' as const,
        dependencies: Array.isArray(s.dependencies)
          ? s.dependencies.filter((d: any) => typeof d === 'string')
          : (index > 0 ? [rawSteps[index - 1]?.action] : []),
      }));
  }

  /**
   * Static template fallback for goal decomposition
   */
  private decomposeGoalFromTemplates(goal: AgentGoal): PlanStep[] {
    const templates = AutonomousAgentOrchestrator.FALLBACK_TEMPLATES[goal.type] || [
      { action: 'analyze', description: `Analyze: ${goal.description}` },
      { action: 'generate_recommendations', description: 'Create detailed action plan' },
      { action: 'create_report', description: 'Generate final report' },
    ];

    return templates.map((template, index) => ({
      ...template,
      id: uuidv4(),
      order: index + 1,
      status: 'pending' as const,
      dependencies: index > 0 ? [templates[index - 1]?.action ?? ''] : [],
    }));
  }

  /**
   * Assess risks for a goal and its plan
   */
  private async assessRisks(goal: AgentGoal, steps: PlanStep[]): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    
    // Check goal priority
    if (goal.priority === 'critical') {
      factors.push({
        category: 'urgency',
        description: 'Critical priority requires immediate attention',
        severity: 0.8,
        likelihood: 1.0
      });
    }
    
    // Check for high-impact actions
    const highImpactActions = ['modify_contract', 'approve', 'terminate', 'execute_payment'];
    for (const step of steps) {
      if (highImpactActions.some(action => step.action.includes(action))) {
        factors.push({
          category: 'impact',
          description: `Step "${step.description}" may have significant impact`,
          severity: 0.7,
          likelihood: 0.8
        });
      }
    }
    
    // Calculate overall risk level
    const avgSeverity = factors.length > 0 
      ? factors.reduce((sum, f) => sum + f.severity * f.likelihood, 0) / factors.length
      : 0;
    
    let level: RiskAssessment['level'] = 'low';
    if (avgSeverity > 0.7) level = 'critical';
    else if (avgSeverity > 0.5) level = 'high';
    else if (avgSeverity > 0.3) level = 'medium';
    
    return {
      level,
      factors,
      mitigations: this.generateMitigations(factors),
      requiresHumanApproval: level === 'high' || level === 'critical'
    };
  }

  /**
   * Generate mitigation strategies for identified risks
   */
  private generateMitigations(factors: RiskFactor[]): string[] {
    const mitigations: string[] = [];
    
    for (const factor of factors) {
      switch (factor.category) {
        case 'urgency':
          mitigations.push('Prioritize this task in execution queue');
          mitigations.push('Alert relevant stakeholders immediately');
          break;
        case 'impact':
          mitigations.push('Require human approval before high-impact actions');
          mitigations.push('Create rollback plan for reversible actions');
          break;
        case 'compliance':
          mitigations.push('Verify all actions against compliance policies');
          mitigations.push('Log detailed audit trail');
          break;
      }
    }
    
    return [...new Set(mitigations)]; // Remove duplicates
  }

  /**
   * Determine which approvals are required
   */
  private determineRequiredApprovals(goal: AgentGoal, risk: RiskAssessment): string[] {
    const approvals: string[] = [];
    
    if (risk.requiresHumanApproval) {
      approvals.push('human_review');
    }
    
    if (risk.level === 'critical') {
      approvals.push('management_approval');
    }
    
    // Goal-type specific approvals
    if (goal.type.includes('payment') || goal.type.includes('financial')) {
      approvals.push('finance_approval');
    }
    
    if (goal.type.includes('legal') || goal.type.includes('compliance')) {
      approvals.push('legal_approval');
    }
    
    return approvals;
  }

  /**
   * Estimate total duration for plan execution
   */
  private estimateDuration(steps: PlanStep[]): number {
    // Rough estimates per step type (in seconds)
    const baseEstimate = 30; // 30 seconds per step
    return steps.length * baseEstimate;
  }

  // ============================================================================
  // EXECUTION ENGINE
  // ============================================================================

  /**
   * Start processing the goal queue
   */
  async startProcessing(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('orchestrator:started');
    
    while (this.executionQueue.length > 0 && this.isRunning) {
      const goal = this.executionQueue.shift();
      if (!goal) continue;
      
      try {
        await this.executeGoal(goal);
      } catch (error) {
        goal.status = 'failed';
        goal.updatedAt = new Date();
        goal.result = {
          success: false,
          summary: `Goal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          outcomes: []
        };
        this.emit('goal:failed', { goal, error });
      }
    }
    
    this.isRunning = false;
    this.emit('orchestrator:idle');
  }

  /**
   * Stop processing (graceful shutdown)
   */
  stopProcessing(): void {
    this.isRunning = false;
    this.stopCronScheduler();
    this.emit('orchestrator:stopping');
  }

  /**
   * Execute a single goal
   */
  private async executeGoal(goal: AgentGoal): Promise<void> {
    this.processingGoal = goal.id;
    
    try {
      // Phase 1: Planning
      if (!goal.plan) {
        await this.planGoal(goal);
      }
      
      // Persist planned state (write-ahead)
      await persistGoalToDB(goal);
      
      // Phase 2: Approval check
      if (goal.plan?.riskAssessment.requiresHumanApproval) {
        goal.status = 'awaiting_approval';
        goal.updatedAt = new Date();
        
        // Persist awaiting_approval state to DB so the approval UI can show it (write-ahead)
        await persistGoalToDB(goal);
        
        this.notifyUser(goal.tenantId, {
          type: 'approval_required',
          title: 'Approval Required',
          message: `High-stakes goal requires your approval: ${goal.description}`,
          goalId: goal.id,
          priority: 'high',
          actionRequired: true
        });
        
        this.emit('goal:awaiting_approval', goal);
        
        // Wait for human approval via DB polling
        await this.waitForApproval(goal.id);
      }
      
      // Phase 3: Execution
      goal.status = 'executing';
      goal.updatedAt = new Date();
      this.emit('goal:executing', goal);
      await persistGoalToDB(goal);
      
      const outcomes: Outcome[] = [];
      
      for (const step of goal.plan?.steps || []) {
        // Check if dependencies are met
        const dependenciesMet = step.dependencies.every(depId => {
          const depStep = goal.plan?.steps.find(s => s.action === depId);
          return depStep?.status === 'completed';
        });
        
        if (!dependenciesMet) {
          step.status = 'skipped';
          continue;
        }
        
        try {
          step.status = 'in_progress';
          step.startedAt = new Date();
          this.emit('step:started', { goal, step });
          
          // Execute the step
          const result = await this.executeStep(goal, step);
          
          step.status = 'completed';
          step.completedAt = new Date();
          step.result = result;
          
          outcomes.push({
            type: step.action,
            description: step.description,
            value: result,
            impact: 'positive'
          });
          
          this.emit('step:completed', { goal, step });
        } catch (error) {
          step.status = 'failed';
          step.error = error instanceof Error ? error.message : 'Unknown error';
          
          outcomes.push({
            type: step.action,
            description: step.description,
            value: step.error,
            impact: 'negative'
          });
          
          this.emit('step:failed', { goal, step, error });
          
          // Decide whether to continue or abort
          if (goal.priority === 'critical') {
            throw error; // Abort on critical goals
          }
          // Otherwise continue with remaining steps
        }
      }
      
      // Phase 4: Completion
      goal.status = 'completed';
      goal.completedAt = new Date();
      goal.updatedAt = new Date();
      goal.result = {
        success: true,
        summary: `Successfully completed: ${goal.description}`,
        outcomes,
        lessonsLearned: await this.extractLessons(goal, outcomes),
        recommendations: await this.generateRecommendations(goal, outcomes)
      };
      
      // Persist final state to DB (write-ahead)
      await persistGoalToDB(goal);
      
      // Persist accumulated token usage for this goal
      await this.persistTokenUsage(goal.id, goal.tenantId);
      
      this.notifyUser(goal.tenantId, {
        type: 'goal_completed',
        title: 'Task Completed',
        message: goal.result.summary,
        goalId: goal.id,
        priority: 'low',
        actionRequired: false
      });
      
      this.emit('goal:completed', goal);
      
    } finally {
      this.processingGoal = null;
    }
  }

  /**
   * Execute a single plan step by dispatching to real services.
   */
  private async executeStep(goal: AgentGoal, step: PlanStep): Promise<unknown> {
    const prisma = await getPrisma();

    switch (step.action) {
      // ── Contract queries ───────────────────────────────────────
      case 'query_contracts': {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const contracts = await prisma.contract.findMany({
          where: {
            tenantId: goal.tenantId,
            endDate: { lte: thirtyDaysFromNow },
            status: { in: ['active', 'pending_renewal'] },
          },
          select: { id: true, title: true, endDate: true, totalValue: true, status: true, vendorName: true },
          orderBy: { endDate: 'asc' },
          take: 50,
        });
        return { contractsFound: contracts.length, contracts };
      }

      case 'scan_contracts': {
        const contracts = await prisma.contract.findMany({
          where: { tenantId: goal.tenantId, status: 'active' },
          select: { id: true, title: true, totalValue: true, type: true, vendorName: true },
          take: 100,
        });
        return { scannedCount: contracts.length, contracts };
      }

      case 'query_pending_workflows': {
        const workflows = await prisma.workflowExecution?.findMany?.({
          where: { tenantId: goal.tenantId, status: 'in_progress' },
          include: { steps: { where: { status: 'pending' } } },
          take: 50,
        }) ?? [];
        return { pendingWorkflows: workflows.length, workflows };
      }

      case 'get_pending_approvals': {
        const approvals = await prisma.workflowStepExecution?.findMany?.({
          where: { tenantId: goal.tenantId, status: 'pending', stepType: 'approval' },
          include: { workflowExecution: { select: { id: true, contractId: true } } },
          take: 30,
        }) ?? [];
        return { pendingCount: approvals.length, approvals };
      }

      // ── Analysis steps (LLM-powered) ──────────────────────────
      case 'analyze_performance':
      case 'analyze_root_cause':
      case 'assess_impact':
      case 'analyze_spending':
      case 'analyze_bottlenecks':
      case 'analyze_contract':
      case 'evaluate_value':
      case 'assess_risk':
      case 'check_compliance':
      case 'review_contract': {
        return this.llmAnalyzeStep(goal, step);
      }

      // ── Comparison / benchmarking ──────────────────────────────
      case 'market_comparison':
      case 'benchmark_rates': {
        const contracts = await prisma.contract.findMany({
          where: { tenantId: goal.tenantId, status: 'active' },
          select: { id: true, title: true, totalValue: true, type: true, vendorName: true },
          take: 30,
        });
        return this.llmAnalyzeStep(goal, step, { contracts });
      }

      // ── Consolidation / under-utilization ──────────────────────
      case 'find_consolidation':
      case 'detect_underutilization': {
        const vendors = await prisma.contract.groupBy({
          by: ['vendorName'],
          where: { tenantId: goal.tenantId, status: 'active' },
          _count: { id: true },
          _sum: { totalValue: true },
          having: { id: { _count: { gt: 1 } } },
        });
        return { duplicateVendors: vendors.length, vendors };
      }

      // ── Generate outputs (LLM) ────────────────────────────────
      case 'generate_recommendations':
      case 'propose_mitigations':
      case 'suggest_improvements':
      case 'create_remediation_plan':
      case 'prioritize_opportunities':
      case 'calculate_roi':
      case 'calculate_metrics': {
        return this.llmAnalyzeStep(goal, step);
      }

      // ── Alerts / notifications ─────────────────────────────────
      case 'create_alert':
      case 'send_reminders':
      case 'escalate_critical':
      case 'notify_approvers': {
        this.notifyUser(goal.tenantId, {
          type: 'insight',
          title: step.description,
          message: `Agent action for goal "${goal.description}": ${step.description}`,
          goalId: goal.id,
          priority: goal.priority === 'critical' ? 'high' : 'medium',
          actionRequired: true,
        });
        return { notified: true, action: step.action };
      }

      // ── Reporting ──────────────────────────────────────────────
      case 'create_report':
      case 'generate_report': {
        const goalSteps = goal.plan?.steps || [];
        const completed = goalSteps.filter(s => s.status === 'completed');
        return this.llmAnalyzeStep(goal, step, {
          completedStepCount: completed.length,
          totalStepCount: goalSteps.length,
        });
      }

      // ── Context gathering ──────────────────────────────────────
      case 'gather_context':
      case 'load_requirements': {
        const relatedContracts = await prisma.contract.findMany({
          where: { tenantId: goal.tenantId },
          select: { id: true, title: true, type: true, status: true },
          take: 20,
        });
        const auditLogs = await prisma.auditLog?.findMany?.({
          where: { tenantId: goal.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }) ?? [];
        return { contextItems: relatedContracts.length + auditLogs.length, relatedContracts, auditLogs };
      }

      // ── Clause / certification checks ──────────────────────────
      case 'check_clauses':
      case 'check_certifications':
      case 'identify_gaps':
      case 'identify_overdue':
      case 'identify_delays':
      case 'categorize_urgency': {
        return this.llmAnalyzeStep(goal, step);
      }

      // ── Workflow execution actions ─────────────────────────────
      case 'select_workflow':
      case 'configure_steps':
      case 'start_execution': {
        // Delegate to WorkflowManagementService if available
        return this.llmAnalyzeStep(goal, step, { action: step.action });
      }

      // ── Approval / decision recording ──────────────────────────
      case 'validate_approvals':
      case 'make_decision':
      case 'record_decision': {
        return this.llmAnalyzeStep(goal, step);
      }

      default:
        // For any unknown action, delegate to LLM analysis
        return this.llmAnalyzeStep(goal, step);
    }
  }

  /**
   * LLM-powered analysis for steps that need reasoning.
   * Falls back to heuristic result if LLM is unavailable.
   */
  private async llmAnalyzeStep(
    goal: AgentGoal,
    step: PlanStep,
    extraContext?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!process.env.OPENAI_API_KEY) {
      return { status: 'completed', action: step.action, note: 'LLM unavailable — heuristic result' };
    }

    try {
      const openai = getOpenAI();

      // Inject learning context — accumulated knowledge improves analysis quality
      const learningCtx = await getLearningContext(goal.tenantId);
      const learnedPatterns = formatLearningContextForPrompt(learningCtx);

      const selectedModel = await getABTestWinnerModel();
      const response = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: `You are a contract management AI agent. Perform the requested analysis step and return results as JSON.
Return a JSON object with meaningful keys relevant to the analysis (e.g., findings, risks, metrics, recommendations).
Be specific and actionable. Keep output under 500 words.
${learnedPatterns ? `\n${learnedPatterns}` : ''}`,
          },
          {
            role: 'user',
            content: `Goal: ${goal.description} (type: ${goal.type}, priority: ${goal.priority})
Step: ${step.action} — ${step.description}
${extraContext ? `\nAdditional context:\n${JSON.stringify(extraContext, null, 2)}` : ''}
${goal.metadata ? `\nGoal metadata:\n${JSON.stringify(goal.metadata)}` : ''}

Perform this analysis step and return the result as JSON.`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 1500,
      });

      // Track token usage for observability
      this.trackTokenUsage(goal.id, response.usage);

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        ...parsed,
        _action: step.action,
        _llmPowered: true,
        _learningContextApplied: learnedPatterns.length > 0,
        _tokensUsed: response.usage?.total_tokens ?? 0,
      };
    } catch (error) {
      return {
        status: 'completed',
        action: step.action,
        note: 'LLM analysis failed — using fallback',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================================================
  // TOKEN USAGE TRACKING
  // ============================================================================

  /**
   * Accumulate token usage for a goal from an OpenAI response.
   */
  private trackTokenUsage(goalId: string, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }): void {
    if (!usage) return;
    const existing = this.goalTokenUsage.get(goalId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 };
    existing.promptTokens += usage.prompt_tokens ?? 0;
    existing.completionTokens += usage.completion_tokens ?? 0;
    existing.totalTokens += usage.total_tokens ?? 0;
    // Estimate cost at $0.15 / 1M input + $0.60 / 1M output (gpt-4o-mini pricing)
    existing.estimatedCost += ((usage.prompt_tokens ?? 0) * 0.00000015) + ((usage.completion_tokens ?? 0) * 0.0000006);
    this.goalTokenUsage.set(goalId, existing);
  }

  /**
   * Persist accumulated token usage to the agent_goals table result JSON.
   */
  private async persistTokenUsage(goalId: string, tenantId: string): Promise<void> {
    const usage = this.goalTokenUsage.get(goalId);
    if (!usage || usage.totalTokens === 0) return;

    try {
      const prisma = await getPrisma();
      // Merge token metrics into the goal's result JSON
      const goal = await prisma.agentGoal?.findUnique?.({ where: { id: goalId }, select: { result: true } });
      const currentResult = (goal?.result as Record<string, unknown>) ?? {};
      await prisma.agentGoal?.update?.({
        where: { id: goalId },
        data: {
          result: {
            ...currentResult,
            _tokenUsage: usage,
          },
        },
      });
    } catch {
      // Non-critical — token data is best-effort
    } finally {
      this.goalTokenUsage.delete(goalId);
    }
  }

  /**
   * Get token usage summary across all completed goals for observability.
   */
  async getTokenUsageSummary(tenantId: string): Promise<{ avgTokensPerTask: number; totalTokensToday: number; estimatedCostToday: number }> {
    try {
      const prisma = await getPrisma();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const goals = await prisma.agentGoal?.findMany?.({
        where: {
          tenantId,
          completedAt: { gte: today },
          status: 'COMPLETED',
        },
        select: { result: true },
      }) ?? [];

      let totalTokens = 0;
      let totalCost = 0;
      let counted = 0;

      for (const g of goals) {
        const tokenUsage = (g.result as any)?._tokenUsage;
        if (tokenUsage?.totalTokens) {
          totalTokens += tokenUsage.totalTokens;
          totalCost += tokenUsage.estimatedCost ?? 0;
          counted++;
        }
      }

      return {
        avgTokensPerTask: counted > 0 ? Math.round(totalTokens / counted) : 0,
        totalTokensToday: totalTokens,
        estimatedCostToday: Math.round(totalCost * 10000) / 10000,
      };
    } catch {
      return { avgTokensPerTask: 0, totalTokensToday: 0, estimatedCostToday: 0 };
    }
  }

  /**
   * Wait for human approval by polling the database.
   * The HITL approval UI (/agents/approvals) approves goals via /api/agents/goals,
   * which sets approvedBy/approvedAt and status=EXECUTING, or status=CANCELLED for rejection.
   * This method watches for either outcome.
   *
   * Escalation behaviour:
   *  - At 50% of the timeout, emits 'goal:approval_escalated' so the notification layer
   *    can widen the audience (e.g. add management / admin).
   *  - At 80% of the timeout, emits a second escalation at 'critical' urgency.
   *  - On full timeout the goal is marked CANCELLED with an escalation-timeout reason.
   */
  private async waitForApproval(goalId: string, timeoutMs: number = 300000): Promise<void> {
    const POLL_INTERVAL = 5000; // 5 seconds
    const deadline = Date.now() + timeoutMs;
    const escalateAt50 = Date.now() + timeoutMs * 0.5;
    const escalateAt80 = Date.now() + timeoutMs * 0.8;
    let escalatedLevel1 = false;
    let escalatedLevel2 = false;
    const prisma = await getPrisma();

    while (Date.now() < deadline) {
      // --- Escalation checks ---
      if (!escalatedLevel1 && Date.now() >= escalateAt50) {
        escalatedLevel1 = true;
        this.emit('goal:approval_escalated', {
          goalId,
          level: 1,
          urgency: 'high',
          message: `Goal ${goalId} has been waiting for approval for ${Math.round(timeoutMs * 0.5 / 60000)} minutes — escalating to management.`,
          additionalRoles: ['management_approval', 'admin'],
        });
        // Persist escalation metadata in the goal's context JSON
        try {
          const existing = await prisma.agentGoal?.findUnique?.({ where: { id: goalId }, select: { context: true } });
          const ctx = (existing?.context as Record<string, unknown>) ?? {};
          await prisma.agentGoal?.update?.({
            where: { id: goalId },
            data: { context: { ...ctx, escalatedAt: new Date().toISOString(), escalationLevel: 1 } },
          });
        } catch { /* non-critical — continue polling */ }
      }

      if (!escalatedLevel2 && Date.now() >= escalateAt80) {
        escalatedLevel2 = true;
        this.emit('goal:approval_escalated', {
          goalId,
          level: 2,
          urgency: 'critical',
          message: `Goal ${goalId} is about to time out — escalating to admin with critical urgency.`,
          additionalRoles: ['admin'],
        });
        try {
          const existing = await prisma.agentGoal?.findUnique?.({ where: { id: goalId }, select: { context: true } });
          const ctx = (existing?.context as Record<string, unknown>) ?? {};
          await prisma.agentGoal?.update?.({
            where: { id: goalId },
            data: { context: { ...ctx, escalatedAt: new Date().toISOString(), escalationLevel: 2 } },
          });
        } catch { /* non-critical */ }
      }

      // --- Status polling ---
      try {
        const goal = await prisma.agentGoal?.findUnique?.({
          where: { id: goalId },
          select: { approvedBy: true, approvedAt: true, status: true },
        });

        // Approved: user clicked "Approve" in the HITL UI
        if (goal?.approvedBy && goal?.approvedAt) {
          this.emit('goal:approved', { goalId, approvedBy: goal.approvedBy, approvedAt: goal.approvedAt });
          return;
        }

        // Also check if status was set to EXECUTING by the goals API (backup check)
        if (goal?.status === 'EXECUTING') {
          this.emit('goal:approved', { goalId, approvedBy: 'api', approvedAt: new Date() });
          return;
        }

        // Rejected: user clicked "Reject" → status set to CANCELLED
        if (goal?.status === 'CANCELLED') {
          // Update in-memory goal to reflect rejection
          const memGoal = this.goals.get(goalId);
          if (memGoal) {
            memGoal.status = 'cancelled';
            memGoal.updatedAt = new Date();
            memGoal.result = { success: false, summary: 'Goal rejected by human reviewer', outcomes: [] };
          }
          throw new Error(`Goal ${goalId} was rejected by human reviewer`);
        }
      } catch (error: any) {
        // P0-FIX: If DB is unavailable, FAIL CLOSED — do NOT auto-approve
        if (error?.code === 'P2021' || error?.code === 'P2010') {
          this.emit('goal:approval_fallback', { goalId, reason: 'DB not available — failing closed' });
          throw new Error(`Cannot verify approval for goal ${goalId} — database unavailable. Failing closed for safety.`);
        }
        // Re-throw rejection errors
        if (error?.message?.includes('rejected')) throw error;
        throw error;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }

    // --- Timeout reached ---
    // Mark goal as timed-out so it shows clearly in the UI
    try {
      await prisma.agentGoal?.update?.({
        where: { id: goalId },
        data: {
          status: 'CANCELLED',
          context: {
            timedOut: true,
            timeoutMs,
            escalationLevel: escalatedLevel2 ? 2 : escalatedLevel1 ? 1 : 0,
            timedOutAt: new Date().toISOString(),
          },
        },
      });
    } catch { /* best-effort */ }

    const memGoal = this.goals.get(goalId);
    if (memGoal) {
      memGoal.status = 'cancelled';
      memGoal.updatedAt = new Date();
      memGoal.result = {
        success: false,
        summary: `Goal timed out after ${timeoutMs / 1000}s waiting for approval (escalation level ${escalatedLevel2 ? 2 : escalatedLevel1 ? 1 : 0})`,
        outcomes: [],
      };
    }

    this.emit('goal:approval_timeout', { goalId, timeoutMs, escalationLevel: escalatedLevel2 ? 2 : escalatedLevel1 ? 1 : 0 });
    throw new Error(`Approval timeout for goal ${goalId} after ${timeoutMs / 1000}s (escalated to level ${escalatedLevel2 ? 2 : escalatedLevel1 ? 1 : 0})`);
  }

  /**
   * Extract lessons learned from goal execution using LLM analysis.
   */
  private async extractLessons(goal: AgentGoal, outcomes: Outcome[]): Promise<string[]> {
    // Start with heuristic lessons (always available)
    const lessons: string[] = [];

    const failedSteps = goal.plan?.steps.filter(s => s.status === 'failed') || [];
    if (failedSteps.length > 0) {
      lessons.push(`${failedSteps.length} step(s) failed — review error handling for: ${failedSteps.map(s => s.action).join(', ')}`);
    }

    const duration = goal.completedAt
      ? (goal.completedAt.getTime() - goal.createdAt.getTime()) / 1000
      : 0;

    if (goal.plan && duration > goal.plan.estimatedDuration * 2) {
      lessons.push(`Execution took ${Math.round(duration)}s vs estimated ${goal.plan.estimatedDuration}s — adjust future estimates`);
    }

    // Enhance with LLM analysis if available
    if (process.env.OPENAI_API_KEY && outcomes.length > 0) {
      try {
        const openai = getOpenAI();
        const selectedModel = await getABTestWinnerModel();
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a process improvement analyst. Review the goal execution and extract 2-4 concise lessons learned. Return JSON: { "lessons": ["lesson1", ...] }',
            },
            {
              role: 'user',
              content: `Goal: ${goal.description} (type: ${goal.type})
Steps: ${JSON.stringify(goal.plan?.steps.map(s => ({ action: s.action, status: s.status })))}
Outcomes: ${JSON.stringify(outcomes.map(o => ({ description: o.description, impact: o.impact })))}
Duration: ${duration}s
Failed steps: ${failedSteps.length}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 500,
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
        if (Array.isArray(parsed.lessons)) {
          lessons.push(...parsed.lessons.filter((l: unknown) => typeof l === 'string').slice(0, 4));
        }
      } catch {
        // LLM enhancement failed — heuristic lessons are still present
      }
    }

    return lessons;
  }

  /**
   * Generate recommendations based on outcomes using LLM analysis.
   */
  private async generateRecommendations(goal: AgentGoal, outcomes: Outcome[]): Promise<string[]> {
    // Start with heuristic recommendations
    const recommendations: string[] = [];

    const positiveOutcomes = outcomes.filter(o => o.impact === 'positive');
    if (positiveOutcomes.length === outcomes.length && outcomes.length > 0) {
      recommendations.push('All outcomes positive — consider scheduling this goal type for regular automated execution');
    }

    const negativeOutcomes = outcomes.filter(o => o.impact === 'negative');
    if (negativeOutcomes.length > 0) {
      recommendations.push(`${negativeOutcomes.length} negative outcome(s) detected — add human review checkpoint before these steps`);
    }

    // Enhance with LLM if available
    if (process.env.OPENAI_API_KEY && outcomes.length > 0) {
      try {
        const openai = getOpenAI();
        const selectedModel = await getABTestWinnerModel();
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: 'You are a contract management advisor. Generate 2-4 actionable recommendations. Return JSON: { "recommendations": ["rec1", ...] }',
            },
            {
              role: 'user',
              content: `Goal: ${goal.description} (type: ${goal.type}, priority: ${goal.priority})
Outcomes: ${JSON.stringify(outcomes.map(o => ({ description: o.description, impact: o.impact, value: o.value })))}
Steps completed: ${goal.plan?.steps.filter(s => s.status === 'completed').length || 0}/${goal.plan?.steps.length || 0}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 500,
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
        if (Array.isArray(parsed.recommendations)) {
          recommendations.push(...parsed.recommendations.filter((r: unknown) => typeof r === 'string').slice(0, 4));
        }
      } catch {
        // LLM enhancement failed — heuristic recommendations are still present
      }
    }

    return recommendations;
  }

  // ============================================================================
  // NOTIFICATION SYSTEM
  // ============================================================================

  /**
   * Send notification to user
   */
  private notifyUser(
    tenantId: string,
    notification: Omit<AgentNotification, 'id' | 'tenantId' | 'read' | 'createdAt'>
  ): void {
    const fullNotification: AgentNotification = {
      ...notification,
      id: uuidv4(),
      tenantId,
      read: false,
      createdAt: new Date()
    };
    
    if (!this.notifications.has(tenantId)) {
      this.notifications.set(tenantId, []);
    }
    
    this.notifications.get(tenantId)!.push(fullNotification);
    
    // Persist notification to audit log for durability
    persistNotificationToDB(fullNotification).catch(() => {});
    
    this.emit('notification:created', fullNotification);
  }

  /**
   * Get notifications for a tenant
   */
  getNotifications(tenantId: string, unreadOnly: boolean = false): AgentNotification[] {
    const notifications = this.notifications.get(tenantId) || [];
    return unreadOnly ? notifications.filter(n => !n.read) : notifications;
  }

  /**
   * Mark notification as read
   */
  markNotificationRead(tenantId: string, notificationId: string): boolean {
    const notifications = this.notifications.get(tenantId);
    if (!notifications) return false;
    
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return false;
    
    notification.read = true;
    return true;
  }

  // ============================================================================
  // STATUS & REPORTING
  // ============================================================================

  /**
   * Get current orchestrator status
   */
  getStatus(): {
    isRunning: boolean;
    processingGoal: string | null;
    queueLength: number;
    activeGoals: AgentGoal[];
    completedToday: number;
    failedToday: number;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const allGoals = Array.from(this.goals.values());
    
    return {
      isRunning: this.isRunning,
      processingGoal: this.processingGoal,
      queueLength: this.executionQueue.length,
      activeGoals: allGoals.filter(g => 
        g.status === 'executing' || g.status === 'planning' || g.status === 'awaiting_approval'
      ),
      completedToday: allGoals.filter(g => 
        g.status === 'completed' && g.completedAt && g.completedAt >= today
      ).length,
      failedToday: allGoals.filter(g => 
        g.status === 'failed' && g.updatedAt >= today
      ).length
    };
  }

  /**
   * Get goal by ID
   */
  getGoal(goalId: string): AgentGoal | undefined {
    return this.goals.get(goalId);
  }

  /**
   * Get all goals for a tenant
   */
  getGoals(tenantId: string, options?: {
    status?: AgentGoalStatus;
    limit?: number;
    offset?: number;
  }): AgentGoal[] {
    let goals = Array.from(this.goals.values())
      .filter(g => g.tenantId === tenantId);
    
    if (options?.status) {
      goals = goals.filter(g => g.status === options.status);
    }
    
    goals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (options?.offset) {
      goals = goals.slice(options.offset);
    }
    
    if (options?.limit) {
      goals = goals.slice(0, options.limit);
    }
    
    return goals;
  }

  /**
   * Get all registered triggers
   */
  getTriggers(tenantId?: string): AgentTrigger[] {
    const triggers = Array.from(this.triggers.values());
    return tenantId 
      ? triggers.filter(t => t.tenantId === tenantId || t.tenantId === 'system')
      : triggers;
  }

  // ============================================================================
  // WORKFLOW MANAGEMENT INTEGRATION
  // ============================================================================

  /**
   * Start an approval workflow for a contract
   * Integrates with the WorkflowManagementService
   */
  async startWorkflowForContract(
    contractId: string,
    tenantId: string,
    options?: {
      workflowId?: string;
      initiatedBy?: string;
      dueDate?: Date;
      autoSelect?: boolean;
    }
  ): Promise<{ success: boolean; executionId?: string; workflowName?: string; error?: string }> {
    try {
      // Dynamically import to avoid circular dependencies
      const { getWorkflowManagementService } = await import('@repo/data-orchestration');
      const workflowService = getWorkflowManagementService();

      if (options?.workflowId) {
        // Use specified workflow
        const executionId = await workflowService.startExecution({
          workflowId: options.workflowId,
          contractId,
          tenantId,
          initiatedBy: options.initiatedBy || 'autonomous-agent',
          dueDate: options.dueDate
        });

        const progress = await workflowService.getExecutionProgress(executionId);
        
        this.notifyUser(tenantId, {
          type: 'goal_started',
          title: 'Workflow Started',
          message: `Started workflow "${progress?.workflowName}" for contract`,
          priority: 'medium',
          actionRequired: true
        });

        return { 
          success: true, 
          executionId, 
          workflowName: progress?.workflowName 
        };
      } else if (options?.autoSelect) {
        // Auto-select best workflow
        const result = await workflowService.suggestWorkflowForContract(
          contractId,
          tenantId,
          { autoStart: true, initiatedBy: options.initiatedBy }
        );

        this.notifyUser(tenantId, {
          type: 'goal_started',
          title: 'Workflow Auto-Started',
          message: `Automatically started "${result.workflowName}" workflow`,
          priority: 'medium',
          actionRequired: true
        });

        return {
          success: true,
          executionId: result.executionId,
          workflowName: result.workflowName
        };
      } else {
        // Just suggest, don't start
        const result = await workflowService.suggestWorkflowForContract(
          contractId,
          tenantId
        );

        return {
          success: true,
          workflowName: result.workflowName
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Process a workflow step action (approve, reject, delegate)
   */
  async processWorkflowAction(
    executionId: string,
    stepId: string,
    action: 'approve' | 'reject' | 'skip' | 'delegate' | 'request_changes',
    userId: string,
    options?: { comment?: string; delegateTo?: string }
  ): Promise<{ success: boolean; message: string; nextStep?: string }> {
    try {
      const { getWorkflowManagementService } = await import('@repo/data-orchestration');
      const workflowService = getWorkflowManagementService();

      const result = await workflowService.processStepAction({
        executionId,
        stepId,
        action,
        userId,
        comment: options?.comment,
        delegateTo: options?.delegateTo
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    }
  }

  /**
   * Get pending workflow approvals for a user or role
   */
  async getPendingApprovals(
    tenantId: string,
    options?: { userId?: string; role?: string; limit?: number }
  ): Promise<any[]> {
    try {
      const { getWorkflowManagementService } = await import('@repo/data-orchestration');
      const workflowService = getWorkflowManagementService();

      return await workflowService.getPendingApprovals(tenantId, options);
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      return [];
    }
  }

  /**
   * Get workflow execution progress
   */
  async getWorkflowProgress(executionId: string): Promise<any | null> {
    try {
      const { getWorkflowManagementService } = await import('@repo/data-orchestration');
      const workflowService = getWorkflowManagementService();

      return await workflowService.getExecutionProgress(executionId);
    } catch (error) {
      console.error('Failed to get workflow progress:', error);
      return null;
    }
  }

  /**
   * Check for overdue workflow steps and escalate
   * Should be called periodically (e.g., every hour)
   */
  async checkWorkflowEscalations(): Promise<{ escalated: number; reminders: number }> {
    try {
      const { getWorkflowManagementService } = await import('@repo/data-orchestration');
      const workflowService = getWorkflowManagementService();

      const result = await workflowService.checkAndEscalateOverdue();
      
      if (result.escalated > 0) {
        this.emit('workflow:escalations', result);
      }

      return result;
    } catch (error) {
      console.error('Failed to check workflow escalations:', error);
      return { escalated: 0, reminders: 0 };
    }
  }

  /**
   * Create a goal to review and process pending workflows
   */
  async createWorkflowReviewGoal(tenantId: string): Promise<AgentGoal> {
    return this.createGoal(
      tenantId,
      'workflow_review',
      'Review pending approval workflows and send reminders',
      {
        priority: 'medium',
        trigger: {
          type: 'schedule',
          source: 'daily_workflow_check'
        }
      }
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: AutonomousAgentOrchestrator | null = null;

export function getAutonomousOrchestrator(): AutonomousAgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AutonomousAgentOrchestrator();
  }
  return orchestratorInstance;
}

export default AutonomousAgentOrchestrator;
