/**
 * Agent Write Gateway
 *
 * Sole path for agent-initiated mutations of domain tables.
 * - Allowlist of mutable fields (critical financial/party/date fields NEVER allowed)
 * - Per-field zod validation
 * - Every attempt recorded as AiDecision with evidence
 * - AGENT_WRITES_ENABLED=false → dry-run (no domain mutation; still audits)
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import {
  isAgentWriteDenylisted,
  isAgentWriteAllowlisted,
  RENEWAL_STATUS_VALUES,
  evaluateAutonomy,
  normalizeAutonomyMode,
  normalizeRiskLevel,
  type AgentAutonomyConfigShape,
  type AutonomyMode,
} from '@repo/utils';
import clientsDb from 'clients-db';
import { logger } from '../utils/logger';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

// ── Types ────────────────────────────────────────────────────────────────────

export type AgentWriteEntity = 'Contract' | 'ContractMetadata' | 'Obligation';

export type AgentWriteStatus = 'applied' | 'pending_approval' | 'rejected';

export interface AgentWriteEvidence {
  citations?: unknown[];
  evidenceChain?: unknown[];
  reason?: string;
}

export interface AgentWriteInput {
  agentId: string;
  tenantId: string;
  entity: AgentWriteEntity;
  entityId: string;
  field: string;
  value: unknown;
  confidence: number;
  evidence?: AgentWriteEvidence;
  model?: string;
  promptVersion?: string;
}

export interface AgentWriteResult {
  status: AgentWriteStatus;
  decisionId: string;
  reason?: string;
}

// ── Schemas (per allowlisted field) ──────────────────────────────────────────

const contractStatusSchema = z.enum([
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
  'ACTIVE',
  'DRAFT',
  'EXPIRED',
  'TERMINATED',
  'PENDING_REVIEW',
]);

const renewalStatusSchema = z.enum(RENEWAL_STATUS_VALUES);

const tagsSchema = z.array(z.string().min(1).max(64)).max(50);

/** Zod validators for allowlisted fields */
export const AGENT_FIELD_SCHEMAS: Record<string, Record<string, z.ZodTypeAny>> = {
  Contract: {
    tags: tagsSchema,
    renewalStatus: renewalStatusSchema,
  },
  ContractMetadata: {},
  Obligation: {},
};

export function isAgentWritesEnabled(): boolean {
  const raw = process.env.AGENT_WRITES_ENABLED;
  if (raw == null || raw === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function inputHash(input: AgentWriteInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        agentId: input.agentId,
        entity: input.entity,
        entityId: input.entityId,
        field: input.field,
        value: input.value,
      }),
    )
    .digest('hex')
    .slice(0, 32);
}

/**
 * Read current field value before proposal/apply so we can store previousValue
 * and later support undo. Best-effort — returns undefined on miss/error.
 */
async function readCurrentFieldValue(
  entity: AgentWriteEntity,
  entityId: string,
  field: string,
  tenantId: string,
): Promise<unknown> {
  try {
    if (entity === 'Contract') {
      const row = await prisma.contract.findFirst({
        where: { id: entityId, tenantId },
      });
      return row ? (row as Record<string, unknown>)[field] : undefined;
    }
    if (entity === 'ContractMetadata') {
      const row = await prisma.contractMetadata.findFirst({
        where: { contractId: entityId, tenantId },
      });
      return row ? (row as Record<string, unknown>)[field] : undefined;
    }
    if (entity === 'Obligation') {
      const row = await prisma.obligation.findFirst({
        where: { id: entityId, tenantId },
      });
      return row ? (row as Record<string, unknown>)[field] : undefined;
    }
  } catch (err) {
    logger.warn(
      {
        error: err instanceof Error ? err.message : String(err),
        entity,
        entityId,
        field,
      },
      'Failed to read current field value for agent write snapshot',
    );
  }
  return undefined;
}

async function recordDecision(
  input: AgentWriteInput,
  outcome: string,
  output: Record<string, unknown>,
  previousValue?: unknown,
): Promise<string> {
  try {
    const row = await prisma.aiDecision.create({
      data: {
        tenantId: input.tenantId,
        contractId: input.entity === 'Contract' ? input.entityId : input.entityId,
        feature: 'agent_write',
        subFeature: `${input.entity}.${input.field}`,
        model: input.model || input.agentId,
        modelVersion: null,
        promptVersion: input.promptVersion ?? null,
        inputHash: inputHash(input),
        inputSummary: `${input.agentId} → ${input.entity}.${input.field}`,
        output,
        outputType: 'agent_field_write',
        confidence: typeof input.confidence === 'number' ? input.confidence : 0,
        processingTimeMs: 0,
        citations: input.evidence?.citations ?? [],
        evidenceChain: input.evidence?.evidenceChain ?? [],
        ...(previousValue !== undefined
          ? { previousValue: previousValue as object | null }
          : {}),
        outcome,
      },
    });
    return row.id as string;
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err), agentId: input.agentId },
      'Failed to persist AiDecision for agent write',
    );
    return `unrecorded-${Date.now()}`;
  }
}

async function applyDomainUpdate(
  entity: AgentWriteEntity,
  entityId: string,
  field: string,
  value: unknown,
): Promise<void> {
  if (entity === 'Contract') {
    await prisma.contract.update({
      where: { id: entityId },
      data: { [field]: value },
    });
    return;
  }
  if (entity === 'ContractMetadata') {
    await prisma.contractMetadata.update({
      where: { contractId: entityId },
      data: { [field]: value },
    });
    return;
  }
  if (entity === 'Obligation') {
    await prisma.obligation.update({
      where: { id: entityId },
      data: { [field]: value },
    });
    return;
  }
  throw new Error(`Unsupported entity: ${entity}`);
}

/** Emit approval_requested when a decision enters pending (best-effort). */
async function emitApprovalRequested(
  tenantId: string,
  decisionId: string,
  props: Record<string, unknown>,
): Promise<void> {
  try {
    if (typeof prisma.analyticsEvent?.create === 'function') {
      await prisma.analyticsEvent.create({
        data: {
          tenantId,
          event: 'approval_requested',
          props: { decisionId, source: 'agent_write', ...props },
        },
      });
    }
  } catch {
    // analytics table may not exist yet in all envs
  }
}

/**
 * Apply (or reject / queue) an agent-proposed field mutation.
 */
export async function applyAgentWrite(input: AgentWriteInput): Promise<AgentWriteResult> {
  const log = logger.child({
    agentId: input.agentId,
    entity: input.entity,
    entityId: input.entityId,
    field: input.field,
  });

  // 1) Absolute deny — critical SSOT fields
  if (isAgentWriteDenylisted(input.field)) {
    const decisionId = await recordDecision(input, 'rejected', {
      status: 'rejected',
      reason: 'denylisted_critical_field',
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      value: input.value,
      agentId: input.agentId,
    });
    log.warn({ decisionId }, 'Agent write rejected: critical field denylist');
    return { status: 'rejected', decisionId, reason: 'denylisted_critical_field' };
  }

  // 2) Allowlist check
  if (!isAgentWriteAllowlisted(input.entity, input.field)) {
    const decisionId = await recordDecision(input, 'rejected', {
      status: 'rejected',
      reason: 'not_allowlisted',
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      value: input.value,
      agentId: input.agentId,
    });
    log.warn({ decisionId }, 'Agent write rejected: field not allowlisted');
    return { status: 'rejected', decisionId, reason: 'not_allowlisted' };
  }

  // 3) Zod validate
  const fieldSchema = AGENT_FIELD_SCHEMAS[input.entity]?.[input.field];
  if (!fieldSchema) {
    const decisionId = await recordDecision(input, 'rejected', {
      status: 'rejected',
      reason: 'missing_schema',
      field: input.field,
    });
    return { status: 'rejected', decisionId, reason: 'missing_schema' };
  }

  const parsed = fieldSchema.safeParse(input.value);
  if (!parsed.success) {
    const decisionId = await recordDecision(input, 'rejected', {
      status: 'rejected',
      reason: 'validation_failed',
      issues: parsed.error.issues,
      value: input.value,
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      agentId: input.agentId,
    });
    log.warn({ decisionId, issues: parsed.error.issues }, 'Agent write rejected: validation failed');
    return { status: 'rejected', decisionId, reason: 'validation_failed' };
  }

  // 4) Feature flag — dry run
  if (!isAgentWritesEnabled()) {
    const decisionId = await recordDecision(input, 'rejected', {
      status: 'rejected',
      reason: 'writes_disabled',
      wouldApply: parsed.data,
      confidence: input.confidence,
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      agentId: input.agentId,
    });
    log.info({ decisionId }, 'Agent write dry-run (AGENT_WRITES_ENABLED=false)');
    return { status: 'rejected', decisionId, reason: 'writes_disabled' };
  }

  // Snapshot current value before pending or apply (needed for undo + old/new diff)
  const previousValue = await readCurrentFieldValue(
    input.entity,
    input.entityId,
    input.field,
    input.tenantId,
  );

  // 5) Per-agent autonomy (Phase 2.1) + legacy global confidence floor
  const autonomyConfig = await loadAutonomyConfig(
    input.tenantId,
    input.agentId,
    `agent_write.${input.entity}.${input.field}`,
  );
  const autonomy = evaluateAutonomy({
    confidence: input.confidence,
    cost: null,
    risk: 'low',
    config: autonomyConfig,
  });

  // Per-agent autonomy is authoritative. Missing config → review (no silent auto-upgrade).
  // When mode=auto, evaluateAutonomy already enforces confidence/cost/risk thresholds.
  const shouldAutoApply = autonomy.allowAutoApply;

  if (!shouldAutoApply) {
    // mode=suggest still records pending so humans can review (same as review for write path)
    const decisionId = await recordDecision(
      input,
      'pending',
      {
        status: 'pending_approval',
        entity: input.entity,
        entityId: input.entityId,
        field: input.field,
        proposedValue: parsed.data,
        confidence: input.confidence,
        threshold: autonomy.thresholds.confidence,
        agentId: input.agentId,
        previousValue,
        autonomyMode: autonomy.mode,
        autonomyReason: autonomy.reason,
      },
      previousValue,
    );
    await emitApprovalRequested(input.tenantId, decisionId, {
      entity: input.entity,
      field: input.field,
      confidence: input.confidence,
      autonomyMode: autonomy.mode,
      autonomyReason: autonomy.reason,
    });
    log.info(
      {
        decisionId,
        confidence: input.confidence,
        autonomyMode: autonomy.mode,
        autonomyReason: autonomy.reason,
      },
      'Agent write pending approval',
    );
    return {
      status: 'pending_approval',
      decisionId,
      reason: autonomy.reason || 'below_auto_apply_threshold',
    };
  }

  // 6) Apply mutation (auto)
  try {
    await applyDomainUpdate(input.entity, input.entityId, input.field, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const decisionId = await recordDecision(
      input,
      'rejected',
      {
        status: 'rejected',
        reason: 'apply_failed',
        error: message,
        entity: input.entity,
        entityId: input.entityId,
        field: input.field,
        agentId: input.agentId,
      },
      previousValue,
    );
    log.error({ decisionId, error: message }, 'Agent write apply failed');
    return { status: 'rejected', decisionId, reason: 'apply_failed' };
  }

  const decisionId = await recordDecision(
    input,
    'auto_applied',
    {
      status: 'applied',
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      value: parsed.data,
      confidence: input.confidence,
      agentId: input.agentId,
      previousValue,
      autonomyMode: autonomy.mode,
      autonomyReason: autonomy.reason,
    },
    previousValue,
  );
  log.info({ decisionId, autonomyMode: autonomy.mode }, 'Agent write applied');
  return { status: 'applied', decisionId };
}

/**
 * Load tenant×agent×action autonomy config. Falls back to agent-level agent_write
 * row, then null (evaluateAutonomy defaults to review).
 */
async function loadAutonomyConfig(
  tenantId: string,
  agentId: string,
  actionType: string,
): Promise<AgentAutonomyConfigShape | null> {
  try {
    if (typeof prisma.agentAutonomyConfig?.findFirst !== 'function') return null;
    const specific = await prisma.agentAutonomyConfig.findFirst({
      where: { tenantId, agentId, actionType },
    });
    const row =
      specific ||
      (await prisma.agentAutonomyConfig.findFirst({
        where: { tenantId, agentId, actionType: 'agent_write' },
      }));
    if (!row) return null;
    return {
      tenantId: row.tenantId,
      agentId: row.agentId,
      actionType: row.actionType,
      mode: normalizeAutonomyMode(row.mode) as AutonomyMode,
      confidenceThreshold: row.confidenceThreshold,
      costThreshold: row.costThreshold,
      riskThreshold: normalizeRiskLevel(row.riskThreshold),
      notifyEmail: row.notifyEmail,
      notifyInApp: row.notifyInApp,
    };
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err), tenantId, agentId },
      'Failed to load AgentAutonomyConfig — defaulting to review',
    );
    return null;
  }
}

export const agentWriteSchemas = {
  contractStatusSchema,
  renewalStatusSchema,
  tagsSchema,
};
