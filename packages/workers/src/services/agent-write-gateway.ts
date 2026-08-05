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
  FIELD_TRUST_THRESHOLDS,
  isAutoApplyConfidence,
  isAgentWriteDenylisted,
  isAgentWriteAllowlisted,
  RENEWAL_STATUS_VALUES,
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

async function recordDecision(
  input: AgentWriteInput,
  outcome: string,
  output: Record<string, unknown>,
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

  // 5) Confidence gate → pending vs auto-apply
  if (!isAutoApplyConfidence(input.confidence)) {
    const decisionId = await recordDecision(input, 'pending', {
      status: 'pending_approval',
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      proposedValue: parsed.data,
      confidence: input.confidence,
      threshold: FIELD_TRUST_THRESHOLDS.high,
      agentId: input.agentId,
    });
    log.info({ decisionId, confidence: input.confidence }, 'Agent write pending approval');
    return { status: 'pending_approval', decisionId, reason: 'below_auto_apply_threshold' };
  }

  // 6) Apply mutation
  try {
    await applyDomainUpdate(input.entity, input.entityId, input.field, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const decisionId = await recordDecision(input, 'rejected', {
      status: 'rejected',
      reason: 'apply_failed',
      error: message,
      entity: input.entity,
      entityId: input.entityId,
      field: input.field,
      agentId: input.agentId,
    });
    log.error({ decisionId, error: message }, 'Agent write apply failed');
    return { status: 'rejected', decisionId, reason: 'apply_failed' };
  }

  const decisionId = await recordDecision(input, 'auto_applied', {
    status: 'applied',
    entity: input.entity,
    entityId: input.entityId,
    field: input.field,
    value: parsed.data,
    confidence: input.confidence,
    agentId: input.agentId,
  });
  log.info({ decisionId }, 'Agent write applied');
  return { status: 'applied', decisionId };
}

export const agentWriteSchemas = {
  contractStatusSchema,
  renewalStatusSchema,
  tagsSchema,
};
