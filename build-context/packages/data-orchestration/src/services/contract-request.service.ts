/**
 * Contract Request Service
 * Handles intake form submissions, triage, routing, and SLA tracking
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface ContractRequestInput {
  tenantId: string;
  requesterId: string;
  title: string;
  description?: string;
  requestType?: string;
  urgency?: string;
  department?: string;
  costCenter?: string;
  estimatedValue?: number;
  currency?: string;
  counterpartyName?: string;
  counterpartyEmail?: string;
  contractType?: string;
  desiredStartDate?: Date;
  desiredEndDate?: Date;
  businessJustification?: string;
  attachments?: object[];
  customFields?: Record<string, unknown>;
}

export interface TriageInput {
  assignedTo?: string;
  triageNotes?: string;
  triagePriority?: string;
  triagedBy: string;
}

const SLA_HOURS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

export class ContractRequestService {
  static async create(input: ContractRequestInput) {
    const slaHours = SLA_HOURS[input.urgency || 'MEDIUM'] || 72;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const request = await prisma.$queryRaw`
      INSERT INTO contract_requests (id, tenant_id, requester_id, title, description, request_type, urgency, department, cost_center, estimated_value, currency, counterparty_name, counterparty_email, contract_type, desired_start_date, desired_end_date, business_justification, attachments, custom_fields, status, sla_deadline, created_at, updated_at)
      VALUES (gen_random_uuid()::text, ${input.tenantId}, ${input.requesterId}, ${input.title}, ${input.description || null}, ${input.requestType || 'NEW_CONTRACT'}, ${input.urgency || 'MEDIUM'}, ${input.department || null}, ${input.costCenter || null}, ${input.estimatedValue || null}, ${input.currency || 'USD'}, ${input.counterpartyName || null}, ${input.counterpartyEmail || null}, ${input.contractType || null}, ${input.desiredStartDate || null}, ${input.desiredEndDate || null}, ${input.businessJustification || null}, ${JSON.stringify(input.attachments || [])}, ${JSON.stringify(input.customFields || {})}, 'SUBMITTED', ${slaDeadline}, NOW(), NOW())
      RETURNING *
    `;

    // Auto-route based on rules
    await ContractRequestService.autoRoute(
      input.tenantId,
      (request as any[])[0]
    );

    return (request as any[])[0];
  }

  static async list(tenantId: string, filters: {
    status?: string;
    assignedTo?: string;
    requesterId?: string;
    urgency?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];

    if (filters.status) {
      conditions.push(Prisma.sql`status = ${filters.status}`);
    }
    if (filters.assignedTo) {
      conditions.push(Prisma.sql`assigned_to = ${filters.assignedTo}`);
    }
    if (filters.requesterId) {
      conditions.push(Prisma.sql`requester_id = ${filters.requesterId}`);
    }
    if (filters.urgency) {
      conditions.push(Prisma.sql`urgency = ${filters.urgency}`);
    }

    const where = Prisma.join(conditions, Prisma.sql` AND `);

    const items = await prisma.$queryRaw`
      SELECT * FROM contract_requests WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total FROM contract_requests WHERE ${where}
    `;

    return {
      items: items as any[],
      total: (countResult as any[])[0]?.total || 0,
      page,
      limit,
    };
  }

  static async getById(tenantId: string, id: string) {
    const result = await prisma.$queryRaw`
      SELECT * FROM contract_requests WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return (result as any[])[0] || null;
  }

  static async triage(tenantId: string, id: string, input: TriageInput) {
    const result = await prisma.$queryRaw`
      UPDATE contract_requests SET assigned_to = ${input.assignedTo || null}, triage_notes = ${input.triageNotes || null}, triage_priority = ${input.triagePriority || null}, triaged_by = ${input.triagedBy}, triaged_at = NOW(), status = 'IN_TRIAGE', updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *
    `;
    return (result as any[])[0] || null;
  }

  static async updateStatus(tenantId: string, id: string, status: string, extras: Record<string, any> = {}) {
    const setClauses: Prisma.Sql[] = [
      Prisma.sql`status = ${status}`,
      Prisma.sql`updated_at = NOW()`,
    ];

    if (extras.rejectedReason) {
      setClauses.push(Prisma.sql`rejected_reason = ${extras.rejectedReason}`);
    }
    if (extras.contractId) {
      setClauses.push(Prisma.sql`contract_id = ${extras.contractId}`);
    }

    const setClause = Prisma.join(setClauses, Prisma.sql`, `);

    const result = await prisma.$queryRaw`
      UPDATE contract_requests SET ${setClause} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *
    `;
    return (result as any[])[0] || null;
  }

  static async autoRoute(tenantId: string, request: any) {
    const rules = await prisma.$queryRaw`
      SELECT * FROM routing_rules WHERE tenant_id = ${tenantId} AND is_active = true ORDER BY priority DESC
    ` as any[];

    for (const rule of rules) {
      if (ContractRequestService.matchesConditions(request, rule.conditions)) {
        await prisma.$queryRaw`
          UPDATE contract_requests SET assigned_to = COALESCE(${rule.assigned_user}, assigned_to), assigned_team = COALESCE(${rule.assigned_team}, NULL), sla_deadline = COALESCE(${rule.sla_hours ? new Date(Date.now() + rule.sla_hours * 60 * 60 * 1000) : null}, sla_deadline), updated_at = NOW() WHERE id = ${request.id}
        `;
        break;
      }
    }
  }

  static matchesConditions(request: any, conditions: any[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond: any) => {
      const value = request[cond.field];
      switch (cond.operator) {
        case 'equals': return value === cond.value;
        case 'contains': return String(value).toLowerCase().includes(String(cond.value).toLowerCase());
        case 'gt': return Number(value) > Number(cond.value);
        case 'lt': return Number(value) < Number(cond.value);
        case 'gte': return Number(value) >= Number(cond.value);
        case 'in': return Array.isArray(cond.value) && cond.value.includes(value);
        default: return true;
      }
    });
  }

  static async getMetrics(tenantId: string) {
    const metrics = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'SUBMITTED')::int as submitted,
        COUNT(*) FILTER(WHERE status = 'IN_TRIAGE')::int as in_triage,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'IN_PROGRESS')::int as in_progress,
        COUNT(*) FILTER(WHERE status = 'COMPLETED')::int as completed,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected,
        COUNT(*) FILTER(WHERE escalated = true)::int as escalated,
        COUNT(*) FILTER(WHERE sla_deadline < NOW() AND status NOT IN ('COMPLETED','REJECTED','CANCELLED'))::int as sla_breached,
        AVG(EXTRACT(EPOCH FROM (COALESCE(triaged_at, NOW()) - created_at)) / 3600)::decimal(10,1) as avg_triage_hours
      FROM contract_requests WHERE tenant_id = ${tenantId}
    `;

    return (metrics as any[])[0];
  }

  static async checkEscalations(tenantId: string) {
    // Find requests past SLA deadline that haven't been escalated
    const overdue = await prisma.$queryRaw`
      UPDATE contract_requests
      SET escalated = true, escalated_at = NOW(), updated_at = NOW()
      WHERE tenant_id = ${tenantId} AND sla_deadline < NOW() AND escalated = false
        AND status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')
      RETURNING *
    `;

    return overdue as any[];
  }
}

export default ContractRequestService;
