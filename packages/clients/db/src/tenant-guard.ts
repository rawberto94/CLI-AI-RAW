/**
 * Application-layer tenant isolation guard for Prisma middleware.
 *
 * Hard-fails writes that omit tenantId; optionally hard-fails reads when
 * TENANT_GUARD_STRICT=true (default in production).
 *
 * This is defense-in-depth before DB RLS FORCE. See Wave D agent-readiness plan.
 */

export type PrismaMiddlewareParams = {
  model?: string;
  action: string;
  args?: {
    where?: Record<string, unknown>;
    data?: Record<string, unknown> | Record<string, unknown>[];
    create?: Record<string, unknown>;
    update?: Record<string, unknown>;
  };
};

/** Models that carry a direct tenantId column and must be scoped. */
export const TENANT_SCOPED_MODELS = [
  'Contract',
  'Artifact',
  'ProcessingJob',
  'FileIntegrity',
  'AuditLog',
  'ContractMetadata',
  'RateCard',
  'Supplier',
  'ComplianceCheck',
  'ContractEmbedding',
  'Obligation',
  'ContractVersion',
  'WorkflowExecution',
  'AgentGoal',
  'AiDecision',
  'Notification',
] as const;

export class TenantGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantGuardError';
  }
}

function hasTenantInWhere(where: Record<string, unknown> | undefined): boolean {
  if (!where || typeof where !== 'object') return false;
  if (typeof where.tenantId === 'string' && where.tenantId.length > 0 && where.tenantId !== 'unknown') {
    return true;
  }
  // AND: [{ tenantId: 'x' }, ...]
  if (Array.isArray(where.AND)) {
    return where.AND.some(
      (clause) =>
        clause &&
        typeof clause === 'object' &&
        typeof (clause as Record<string, unknown>).tenantId === 'string' &&
        String((clause as Record<string, unknown>).tenantId).length > 0,
    );
  }
  return false;
}

function hasTenantInData(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const tenantId = (data as Record<string, unknown>).tenantId;
  return typeof tenantId === 'string' && tenantId.length > 0 && tenantId !== 'unknown';
}

export type TenantGuardOptions = {
  /** When true, findMany/count/etc without tenantId throw. Default: production-like. */
  strictReads?: boolean;
};

/**
 * Validate a Prisma middleware call. Mutates nothing; throws TenantGuardError on violation.
 * Returns { ok: true } or throws.
 */
export function assertTenantGuard(
  params: PrismaMiddlewareParams,
  options: TenantGuardOptions = {},
): void {
  const model = params.model;
  if (!model || !TENANT_SCOPED_MODELS.includes(model as (typeof TENANT_SCOPED_MODELS)[number])) {
    return;
  }

  const action = params.action;
  const args = params.args || {};
  const strictReads =
    options.strictReads ??
    (process.env.TENANT_GUARD_STRICT === 'true' || process.env.NODE_ENV === 'production');

  // Creates must include tenantId on data
  if (action === 'create') {
    if (!hasTenantInData(args.data)) {
      throw new TenantGuardError(`tenantId is required when creating ${model}`);
    }
    return;
  }

  if (action === 'createMany') {
    const rows = Array.isArray(args.data) ? args.data : args.data ? [args.data] : [];
    for (const row of rows) {
      if (!hasTenantInData(row)) {
        throw new TenantGuardError(`tenantId is required on every row when createMany ${model}`);
      }
    }
    return;
  }

  if (action === 'upsert') {
    if (!hasTenantInData(args.create)) {
      throw new TenantGuardError(`tenantId is required in upsert create block for ${model}`);
    }
    // Prefer tenant on where as well
    if (!hasTenantInWhere(args.where) && strictReads) {
      throw new TenantGuardError(`tenantId is required in upsert where for ${model}`);
    }
    return;
  }

  // Mutations must filter by tenantId
  if (['update', 'updateMany', 'delete', 'deleteMany'].includes(action)) {
    if (!hasTenantInWhere(args.where)) {
      throw new TenantGuardError(
        `tenantId is required in where when ${action} on ${model} (cross-tenant write blocked)`,
      );
    }
    return;
  }

  // Reads
  if (['findMany', 'count', 'aggregate', 'groupBy'].includes(action)) {
    if (!hasTenantInWhere(args.where)) {
      if (strictReads) {
        throw new TenantGuardError(
          `tenantId is required in where when ${action} on ${model} (cross-tenant read blocked)`,
        );
      }
    }
    return;
  }

  // findFirst / findUnique — require tenant when strict (findUnique often uses unique id only)
  if (['findFirst', 'findUnique'].includes(action) && strictReads) {
    // findUnique by id alone is common; allow if where has id AND we cannot express composite —
    // but prefer tenantId. Only hard-fail findFirst without tenant in strict mode.
    if (action === 'findFirst' && !hasTenantInWhere(args.where)) {
      throw new TenantGuardError(
        `tenantId is required in where when findFirst on ${model} (cross-tenant read blocked)`,
      );
    }
  }
}

/**
 * Strict *reads* are opt-in via TENANT_GUARD_STRICT=true.
 * Writes always require tenantId regardless (see assertTenantGuard).
 * Default false so existing findUnique({ where: { id } }) paths keep working
 * until call sites are fully tenant-scoped.
 */
export function isTenantGuardStrict(): boolean {
  return process.env.TENANT_GUARD_STRICT === 'true';
}
